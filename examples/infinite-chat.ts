import { InitClient, SglClient } from "../src/mod.ts";

class InfiniteChat {
  readonly #client: InitClient;
  #ai: InitClient;
  constructor(client: InitClient) {
    this.#client = client;
    this.#ai = this.#client;
  }

  async #summarize(ai: InitClient) {
    const [{ summary }] = await ai
      .user((c) => c.push("Summarize the conversation."))
      .assistant((c) =>
        c.gen("summary", {
          maxTokens: 512,
        })
      )
      .run();
    console.log(`[DEBUG SUMMARY]: ${summary.trim()}`);
    return summary.trim();
  }

  async #setHistory(history: string, ai: InitClient) {
    if (history.length > 1000) {
      const summary = await this.#summarize(ai);
      this.#ai = this.#client.system((t) =>
        t.push(
          `You are participating of a conversation which was summarized by the AI Model as "${summary}".\n Continue the conversation.`
        )
      );
    } else {
      this.#ai = ai;
    }
  }

  async loop() {
    const msg = prompt("User:");
    if (msg == null) {
      return;
    }

    const [{ response }, ai, history] = await this.#ai
      .user((t) => t.push(msg))
      .assistant((t) =>
        t.gen("response", {
          maxTokens: 512,
        })
      )
      .run();
    console.log(`Assistant: ${response.trim()}`);
    await this.#setHistory(history, ai);
    await this.loop();
  }
}

const main = async () => {
  const client = new SglClient(`http://localhost:30004`, {
    template: "llama-2-chat",
    temperature: 0.1,
  });
  const chat = new InfiniteChat(client);
  await chat.loop();
};

main();
