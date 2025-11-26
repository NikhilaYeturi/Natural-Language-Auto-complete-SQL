// lib/types.ts
import { TransactionRow } from "./sampleData";

export interface Message {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content:
    | string
    | Array<{
        type: 'text' | 'image' | 'input_text' | 'input_file';
        text?: string;
        data?: any;
        mimeType?: string;
      }>;
  name?: string;
  createdAt?: Date;
}

export interface QueryOption {
  description: string;
  sqlQuery: string;
}

export interface GroupedRow {
  label: string;
  value: number;
}

type OutputRow = TransactionRow | GroupedRow;

export const outputRows: OutputRow[] = [];