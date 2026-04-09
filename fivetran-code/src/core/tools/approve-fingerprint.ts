import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID whose SSH fingerprint to approve"),
  hash: z
    .string()
    .optional()
    .describe("Hash of the SSH host fingerprint. If omitted, auto-detects pending fingerprints."),
  public_key: z
    .string()
    .optional()
    .describe("SSH public key. Required if hash is provided."),
});

interface FingerprintItem {
  hash: string;
  public_key?: string;
  validated_by?: string;
  validated_date?: string;
}

interface FingerprintListData {
  items: FingerprintItem[];
}

interface FingerprintApproveData {
  hash: string;
  public_key: string;
  validated_by?: string;
  validated_date?: string;
}

export const approveFingerprintTool: FivetranTool = {
  name: "approve_fingerprint",
  permission: "write",
  definition: {
    name: "approve_fingerprint",
    description:
      "Approve an SSH host fingerprint for a Fivetran connection. " +
      "Use when test_connection fails due to SSH fingerprint validation (e.g., database connectors using SSH tunnel). " +
      "Can auto-detect pending fingerprints if hash/public_key are not provided. " +
      "After approval, re-run test_connection to verify the connection succeeds.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: {
          type: "string",
          description: "The connection ID whose fingerprint to approve",
        },
        hash: {
          type: "string",
          description:
            "Hash of the SSH host fingerprint. If omitted, auto-detects pending fingerprints.",
        },
        public_key: {
          type: "string",
          description:
            "SSH public key string. Required when hash is provided.",
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
      // If hash + public_key provided, approve directly
      if (parsed.hash && parsed.public_key) {
        const response = await api.post<FingerprintApproveData>(
          `/connections/${connId}/fingerprints`,
          {
            hash: parsed.hash,
            public_key: parsed.public_key,
          }
        );
        return {
          success: true,
          data: {
            approved: [{ hash: parsed.hash }],
            details: response.data,
            message: "Fingerprint approved. Run test_connection to verify.",
          },
        };
      }

      // Auto-detect: trigger a test to surface pending fingerprints
      await api.post(`/connections/${connId}/test`).catch(() => {
        // Test may fail — expected when fingerprint is pending
      });

      // Fetch fingerprints for this connection
      const fpResponse = await api.get<FingerprintListData>(
        `/connections/${connId}/fingerprints`
      );
      const fingerprints = fpResponse.data?.items ?? [];

      if (fingerprints.length === 0) {
        return {
          success: false,
          error:
            "No fingerprints found for this connection. " +
            "Run test_connection first to trigger fingerprint discovery, " +
            "then provide the hash and public_key from the test response.",
        };
      }

      // Find fingerprints not yet validated
      const pending = fingerprints.filter((f) => !f.validated_by);

      if (pending.length === 0) {
        return {
          success: true,
          data: {
            approved: [],
            all_fingerprints: fingerprints,
            message:
              "All fingerprints are already approved. Run test_connection to verify.",
          },
        };
      }

      // Approve each pending fingerprint
      const approved: { hash: string }[] = [];
      const errors: string[] = [];

      for (const fp of pending) {
        try {
          await api.post(`/connections/${connId}/fingerprints`, {
            hash: fp.hash,
            public_key: fp.public_key ?? "",
          });
          approved.push({ hash: fp.hash });
        } catch (err) {
          errors.push(
            `Failed to approve fingerprint ${fp.hash}: ${err instanceof Error ? err.message : String(err)}`
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
          message: `Approved ${approved.length} fingerprint(s). Run test_connection to verify.`,
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
