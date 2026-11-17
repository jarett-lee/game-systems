# TypeScript, not Rust compiled to WebAssembly

Everything is written in TypeScript. Rust compiled to WebAssembly was seriously considered, on the idea that AI writes Rust well, but research found no evidence that models write better Rust than TypeScript, and a Rust core would add a JS-to-WASM boundary layer, an extra build step, and two-language debugging, all for Demos that don't need Rust's performance. Because Systems are logic only (ADR 0002), porting one to Rust later stays possible.
