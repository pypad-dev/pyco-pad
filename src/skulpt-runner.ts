export class SkulptRunner {
  private outputDiv: HTMLElement;
  private chkSafeMode: HTMLInputElement;
  
  private outputBuffer: string[] = [];
  private bufferedLineCount: number = 0;
  private bufferedCharCount: number = 0;
  private isExecutionTerminated: boolean = false;
  
  constructor() {
    this.outputDiv = document.getElementById('output') as HTMLElement;
    this.chkSafeMode = document.getElementById('chk-safe-mode') as HTMLInputElement;
    
    document.getElementById('btn-clear')?.addEventListener('click', () => this.clearOutput());
  }

  public clearOutput() {
    this.outputDiv.innerHTML = "";
  }

  /** The program's own text as the student saw it: no timing line, no notice. Empty if nothing has run. */
  public savedOutput(): string {
    const skip = ['output-success', 'output-stale'];
    return Array.from(this.outputDiv.children)
      .filter((el) => !skip.some((c) => el.classList.contains(c)))
      .map((el) => el.textContent || '')
      .join('')
      .trim();
  }

  /** Puts earlier output back, as when the student returns to the question. */
  public showSaved(text: string) {
    this.clearOutput();
    if (!text) return;
    const span = document.createElement('span');
    span.textContent = text;
    this.outputDiv.appendChild(span);
  }

  private flushBufferToScreen() {
    if (this.outputBuffer.length > 0) {
        const span = document.createElement('span');
        span.innerText = this.outputBuffer.join("");
        this.outputDiv.appendChild(span);
        this.outputBuffer = [];
    }
  }

  private outf = (text: string) => {
    if (this.isExecutionTerminated) return;

    this.outputBuffer.push(text);

    // Track lines and total string size (pseudo-memory protection)
    this.bufferedLineCount += (text.match(/\n/g) || []).length;
    this.bufferedCharCount += text.length;

    if (this.chkSafeMode && this.chkSafeMode.checked) {
        // Check for both Line limits and Byte/Character limits
        if (this.bufferedLineCount > 100 || this.bufferedCharCount > 50000) {
            this.isExecutionTerminated = true;
            this.flushBufferToScreen();

            const s = document.createElement('span');
            s.className = 'output-error';

            if (this.bufferedLineCount > 100) {
                s.innerText = "\n\n[Safe Mode Error]: Code terminated. Generated output exceeded 100 lines.";
            } else {
                s.innerText = "\n\n[Safe Mode Error]: Code terminated. Output exceeded memory limits (50,000 characters).";
            }

            this.outputDiv.appendChild(s);
            this.outputDiv.scrollTop = this.outputDiv.scrollHeight;

            throw new Error("Output limit exceeded");
        }
    }
  }

  private builtinRead = (x: string) => {
    // @ts-ignore
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) throw "Err";
    // @ts-ignore
    return Sk.builtinFiles["files"][x];
  }

  // The output is cleared at once and left empty for this long before the program runs,
  // so a rerun with identical output is seen to refresh.
  private static readonly START_DELAY_MS = 150;

  public runCode(code: string) {
    this.clearOutput();
    this.outputBuffer = [];
    this.bufferedLineCount = 0;
    this.bufferedCharCount = 0;
    this.isExecutionTerminated = false;

    // @ts-ignore
    if (typeof Sk === 'undefined') {
        const s = document.createElement('span');
        s.className = 'output-error';
        s.innerText = "\nError: Python engine is still loading. Please try again in a moment.";
        this.outputDiv.appendChild(s);
        return;
    }

    setTimeout(() => {
        const startedAt = performance.now();
        const isSafeMode = this.chkSafeMode && this.chkSafeMode.checked;

        // @ts-ignore
        Sk.configure({
            output: this.outf,
            read: this.builtinRead,
            // @ts-ignore
            __future__: Sk.python3,
            execLimit: isSafeMode ? 1000 : Number.POSITIVE_INFINITY
        });

        // @ts-ignore
        Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true))
            .then(() => {
                if (this.isExecutionTerminated) return;
                this.flushBufferToScreen();

                const s = document.createElement('span');
                s.className = 'output-success';
                const ms = performance.now() - startedAt;
                s.innerText = `\n>>> Finished successfully in ${ms < 1000 ? Math.max(1, Math.round(ms)) + ' ms' : (ms / 1000).toFixed(2) + ' s'}.`;
                this.outputDiv.appendChild(s);
                this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
            }, (err: any) => {
                if (this.isExecutionTerminated) return;
                this.flushBufferToScreen();

                const s = document.createElement('span');
                s.className = 'output-error';

                if (err.toString().includes("TimeLimitError")) {
                    s.innerText = "\n\n[Safe Mode Error]: Time limit exceeded. Execution timed out after 1.0 second.";
                } else {
                    s.innerText = "\n" + err.toString();
                }

                this.outputDiv.appendChild(s);
                this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
            });
    }, SkulptRunner.START_DELAY_MS);
  }
}
