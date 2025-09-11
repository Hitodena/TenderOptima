// Type declarations for modules without TypeScript definitions
declare module 'node-imap' {
  export default class Imap {
    constructor(config: {
      user: string;
      password: string;
      host: string;
      port: number;
      tls: boolean;
      tlsOptions?: {
        rejectUnauthorized: boolean;
      };
      authTimeout?: number;
      connTimeout?: number;
      keepalive?: boolean;
      debug?: any;
    });

    once(event: string, listener: (...args: any[]) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    connect(): void;
    openBox(mailboxName: string, readOnly: boolean, callback: (err: any, box: any) => void): void;
    search(criteria: any[], callback: (err: any, results: number[]) => void): void;
    fetch(source: any, options: any): any;
  }
}

declare module 'mailparser' {
  export function simpleParser(stream: any, callback: (err: any, parsed: any) => void): void;
}