export type TasksOutput = { text: string; captured: Record<string, string> };

/**
 * Interface for fetching from a SGL server.
 */
export type SglFetcher = {
  runThread: (data: GenerationThread) => Promise<TasksOutput>;
};

export type AddTextTask = {
  tag: "AddTextTask";
  text: string;
};

export type GenerateTask = {
  tag: "GenerateTask";
  name: string | undefined;
  stop: string[];
  max_tokens: number;
  regex: string | undefined;
};

export type SelectTask = {
  tag: "SelectTask";
  name: string | undefined;
  choices: string[];
};

export type Task = AddTextTask | GenerateTask | SelectTask;

type SglSamplingParams = {
  skip_special_tokens: boolean;
  max_new_tokens: number;
  stop: string | string[];
  temperature: number;
  top_p: number;
  top_k: number;
  frequency_penalty: number;
  presence_penalty: number;
  ignore_eos: boolean;
  regex: string | undefined;
  dtype: string | undefined;
};
const createSglSamplingParams = (
  params: Partial<SglSamplingParams>,
  fetcher_params: Partial<FetcherSamplingParams>
): SglSamplingParams => {
  return {
    skip_special_tokens: params.skip_special_tokens ?? true,
    max_new_tokens: params.max_new_tokens ?? 16,
    stop: params.stop ?? [],
    temperature: fetcher_params?.temperature ?? params.temperature ?? 1.0,
    top_p: fetcher_params.top_p ?? params.top_p ?? 1.0,
    top_k: fetcher_params.top_k ?? params.top_k ?? -1,
    frequency_penalty:
      fetcher_params.frequency_penalty ?? params.frequency_penalty ?? 0.0,
    presence_penalty:
      fetcher_params.presence_penalty ?? params.presence_penalty ?? 0.0,
    ignore_eos: params.ignore_eos ?? false,
    regex: params.regex,
    dtype: params.dtype,
  };
};

export type FetcherSamplingParams = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
};

export type GenerationThread = {
  sampling_params: FetcherSamplingParams;
  tasks: Task[];
  initial_text: string;
};

/**
 * Options for the generation task.
 */
type SglGenerateData = {
  text: string;
  sampling_params: SglSamplingParams;
};

/**
 * Options for the selection task.
 */
type SglSelectData = {
  text: string[];
  sampling_params: SglSamplingParams;
  return_logprob: boolean;
  logprob_start_len: number;
};

/**
 * Meta information about the generation task.
 */
type MetaInfoGeneration = {
  prompt_tokens: number;
  completion_tokens: number;
};

/**
 * Meta information about the selection task.
 */
type MetaInfoSelection = {
  prompt_tokens: number;
  completion_tokens: number;

  normalized_prompt_logprob: number;
  prompt_logprob: number;
};

/**
 * Fetches from a regular SGL server.
 */

export class SglServerFetcher implements SglFetcher {
  readonly #url: string;

  constructor(url: string) {
    this.#url = url;
  }
  async runThread(data: GenerationThread): Promise<TasksOutput> {
    let text = data.initial_text;
    const captured: Record<string, string> = {};
    for (const task of data.tasks) {
      switch (task.tag) {
        case "AddTextTask": {
          text += task.text;
          break;
        }
        case "GenerateTask": {
          const out = await this.#generate({
            text,
            sampling_params: createSglSamplingParams(
              {
                max_new_tokens: task.max_tokens,
                stop: task.stop,
              },
              data.sampling_params
            ),
          });
          text += out.text;
          if (task.name != null) {
            captured[task.name] = out.text;
          }
          break;
        }
        case "SelectTask": {
          // Cache common prefix
          const res = await this.#generate({
            text: text,
            sampling_params: createSglSamplingParams(
              { max_new_tokens: 0, temperature: 0.0 },
              data.sampling_params
            ),
          });

          const prompt_len = res.meta_info.prompt_tokens;

          const obj = await this.#select({
            text: task.choices.map((c) => text + c),
            sampling_params: createSglSamplingParams(
              {
                max_new_tokens: 0,
                temperature: 0.0,
              },
              data.sampling_params
            ),
            return_logprob: true,
            logprob_start_len: Math.max(prompt_len - 2, 0),
          });

          const normalized_prompt_logprob = obj.map(
            (r) => r.meta_info.normalized_prompt_logprob
          );

          const argMax = normalized_prompt_logprob.reduce(
            (iMax, x, i, arr) => (x > arr[iMax] ? i : iMax),
            0
          );
          const decision = task.choices[argMax];

          text += decision;
          if (task.name != null) {
            captured[task.name] = decision;
          }

          break;
        }
        default:
          throw new Error("Unknown task type");
      }
    }

    return {
      text,
      captured,
    };
  }

  async #httpRequest<T>(data: object): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(this.#url + "/generate", {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      if (!response.ok) {
        console.error((await response.text()).slice(0, 500));
        throw new Error("HTTP error " + response.status);
      }

      return await response.json();
    } catch (e) {
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }
  #generate(
    data: SglGenerateData
  ): Promise<{ text: string; meta_info: MetaInfoGeneration }> {
    return this.#httpRequest(data);
  }
  #select(
    data: SglSelectData
  ): Promise<{ text: string; meta_info: MetaInfoSelection }[]> {
    return this.#httpRequest(data);
  }
}
