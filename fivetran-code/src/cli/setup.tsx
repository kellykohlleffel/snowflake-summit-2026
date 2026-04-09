import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { saveConfig } from "../core/config/manager.js";
import type { AppConfig } from "../core/config/types.js";

type SetupStep = "fivetran_key" | "fivetran_secret" | "anthropic_key" | "done";

interface Props {
  onComplete: (config: AppConfig) => void;
}

export function SetupFlow({ onComplete }: Props) {
  const [step, setStep] = useState<SetupStep>("fivetran_key");
  const [fivetranKey, setFivetranKey] = useState("");
  const [fivetranSecret, setFivetranSecret] = useState("");
  const [value, setValue] = useState("");

  const handleSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    switch (step) {
      case "fivetran_key":
        setFivetranKey(trimmed);
        setValue("");
        setStep("fivetran_secret");
        break;
      case "fivetran_secret":
        setFivetranSecret(trimmed);
        setValue("");
        setStep("anthropic_key");
        break;
      case "anthropic_key": {
        const config: AppConfig = {
          fivetranApiKey: fivetranKey,
          fivetranApiSecret: fivetranSecret,
          anthropicApiKey: trimmed,
        };
        await saveConfig(config);
        onComplete(config);
        setStep("done");
        break;
      }
    }
  };

  if (step === "done") return null;

  const prompts: Record<string, string> = {
    fivetran_key: "Enter your Fivetran API Key:",
    fivetran_secret: "Enter your Fivetran API Secret:",
    anthropic_key: "Enter your Anthropic API Key:",
  };

  const stepNumber =
    step === "fivetran_key" ? 1 : step === "fivetran_secret" ? 2 : 3;

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="blue">
        First-time setup ({stepNumber}/3)
      </Text>
      <Text>{prompts[step]}</Text>
      <Box>
        <Text color="cyan">{"> "}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          mask="*"
        />
      </Box>
    </Box>
  );
}
