"use client";
/**
 * Read-only code block + copy button, manages its own "copied" hint state.
 * Used to display webhook URL, signing secret, Agent setup instructions, etc.
 */
import { useState } from "react";
import { IconCheck, IconCopy } from '@tabler/icons-react';

import { Button } from "@/components/ui/button";

import style from "./style.module.css";

interface CodeBlockProps {
  value: string;
  label?: string;
  multiline?: boolean;
}

export default function CodeBlock({ value, label, multiline = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={style.codeBlock}>
      {label ? <label>{label}</label> : null}
      <code className={multiline ? style.multiline : undefined}>{value}</code>
      <div className={style.action}>
        {
          copied ?
            <Button variant="outline">
              <IconCheck stroke={1.5} />
            </Button>
            : (
              <Button variant="outline" onClick={handleCopy}>
                <IconCopy stroke={1.5} />
              </Button>
            )
        }
      </div>
    </div>
  );
}
