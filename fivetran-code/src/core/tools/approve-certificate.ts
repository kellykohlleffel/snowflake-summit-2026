import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID whose certificate to approve"),
  hash: z
    .string()
    .optional()
    .describe("SHA-256 hash of the certificate. If omitted, auto-detects pending certificates."),
  encoded_cert: z
    .string()
    .optional()
    .describe("Base64-encoded certificate. Required if hash is provided."),
});

interface CertificateItem {
  hash: string;
  public_key?: string;
  name?: string;
  type?: string;
  sha1?: string;
  sha256?: string;
  validated_by?: string;
  validated_date?: string;
  encoded_cert?: string;
}

interface CertificateListData {
  items: CertificateItem[];
}

interface CertificateApproveData {
  hash: string;
  encoded_cert: string;
  validated_by?: string;
  validated_date?: string;
}

export const approveCertificateTool: FivetranTool = {
  name: "approve_certificate",
  permission: "write",
  definition: {
    name: "approve_certificate",
    description:
      "Approve a TLS/SSL certificate for a Fivetran connection. " +
      "Use when test_connection fails due to certificate validation (e.g., Google Cloud PostgreSQL with Direct Connect). " +
      "Can auto-detect pending certificates if hash/encoded_cert are not provided. " +
      "After approval, re-run test_connection to verify the connection succeeds.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: {
          type: "string",
          description: "The connection ID whose certificate to approve",
        },
        hash: {
          type: "string",
          description:
            "SHA-256 hash of the certificate to approve. If omitted, auto-detects pending certificates from the connection.",
        },
        encoded_cert: {
          type: "string",
          description:
            "Base64-encoded certificate. Required when hash is provided.",
        },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const api = getFivetranApi();
    const connId = parsed.connection_id;

    try {
      // If hash + encoded_cert provided, approve directly
      if (parsed.hash && parsed.encoded_cert) {
        const response = await api.post<CertificateApproveData>(
          `/connections/${connId}/certificates`,
          {
            hash: parsed.hash,
            encoded_cert: parsed.encoded_cert,
          }
        );
        return {
          success: true,
          data: {
            approved: [{ hash: parsed.hash }],
            details: response.data,
            message: "Certificate approved. Run test_connection to verify.",
          },
        };
      }

      // Auto-detect: first run a connection test to surface pending certificates
      await api.post(`/connections/${connId}/test`).catch(() => {
        // Test may fail — that's expected when cert is pending
      });

      // Fetch certificates for this connection (includes pending ones)
      const certsResponse = await api.get<CertificateListData>(
        `/connections/${connId}/certificates`
      );
      const certs = certsResponse.data?.items ?? [];

      if (certs.length === 0) {
        return {
          success: false,
          error:
            "No certificates found for this connection. " +
            "Run test_connection first to trigger certificate discovery, " +
            "then provide the hash and encoded_cert from the test response.",
        };
      }

      // Find certificates not yet validated (pending approval)
      const pending = certs.filter((c) => !c.validated_by);

      if (pending.length === 0) {
        return {
          success: true,
          data: {
            approved: [],
            all_certificates: certs,
            message:
              "All certificates are already approved. Run test_connection to verify.",
          },
        };
      }

      // Approve each pending certificate
      const approved: { hash: string; name?: string }[] = [];
      const errors: string[] = [];

      for (const cert of pending) {
        try {
          await api.post(`/connections/${connId}/certificates`, {
            hash: cert.hash,
            encoded_cert: cert.encoded_cert ?? cert.public_key ?? "",
          });
          approved.push({ hash: cert.hash, name: cert.name });
        } catch (err) {
          errors.push(
            `Failed to approve cert ${cert.hash}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      if (approved.length === 0 && errors.length > 0) {
        return { success: false, error: errors.join("; ") };
      }

      return {
        success: true,
        data: {
          approved,
          errors: errors.length > 0 ? errors : undefined,
          message: `Approved ${approved.length} certificate(s). Run test_connection to verify.`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
