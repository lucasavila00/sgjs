import { pipeline } from "./pipeline.ts";
import {
  GeneratorOptions,
  InitializedModel,
  LMGenerator,
  MetaInfo,
  StateFn,
  gen,
} from "./types.ts";

const createSglSamplingParams = (
  params: Partial<SglSamplingParams>
): SglSamplingParams => {
  return {
    skip_special_tokens: params.skip_special_tokens ?? true,
    max_new_tokens: params.max_new_tokens ?? 16,
    stop: params.stop ?? [],
    temperature: params.temperature ?? 1.0,
    top_p: params.top_p ?? 1.0,
    top_k: params.top_k ?? -1,
    frequency_penalty: params.frequency_penalty ?? 0.0,
    presence_penalty: params.presence_penalty ?? 0.0,
    ignore_eos: params.ignore_eos ?? false,
    regex: params.regex,
    dtype: params.dtype,
  };
};

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
type SglGenerateData = {
  text: string;
  sampling_params: SglSamplingParams;
};
const httpRequest = async (
  url: string,
  sglGenerateData: SglGenerateData
): Promise<{
  text: string;
  meta_info: MetaInfo;
}> => {
  const response = await fetch(url + "/generate", {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(sglGenerateData),
  });
  if (!response.ok) {
    console.error((await response.text()).slice(0, 500));
    throw new Error("HTTP error " + response.status);
  }
  const json = await response.json();
  return json;
};
export type CreateSglModelOptions = { temperature?: number; echo?: boolean };
const createSglModelRecursive = (
  url: string,
  creatorOptions: CreateSglModelOptions,
  initialState: {
    captured: any;
    text: string;
    metaInfos: MetaInfo[];
  }
): StateFn<any> => {
  const handler: StateFn<any> = async (strings, ...keys) => {
    // iterate over string or key, in order
    // if key is a string, append to text
    // if key is a generator, call the model with the text and generator options

    const rec: StateFn<any> = createSglModelRecursive(url, creatorOptions, {
      captured: { ...handler.captured },
      text: handler.text,
      metaInfos: [...handler.metaInfos],
    });

    const addText = (text: string) => {
      if (creatorOptions.echo) {
        console.log(text);
      }
      rec.text += text;
    };

    addText(strings[0]);

    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const string = strings[index + 1];
      if (typeof key === "string") {
        addText(key);
      } else if (typeof key === "number") {
        addText(String(key));
      } else {
        const outWithMeta = await httpRequest(url, {
          text: rec.text,
          sampling_params: createSglSamplingParams({
            temperature: creatorOptions.temperature,
            max_new_tokens: key.options.maxTokens,
            stop: key.options.stop,
          }),
        });
        const { text: out, meta_info } = outWithMeta;
        rec.metaInfos.push(meta_info);
        rec.captured = {
          ...rec.captured,
          [key.name]: out,
        };
        addText(out);
      }
      addText(string);
    }

    return rec;
  };
  handler.captured = initialState.captured;
  handler.text = initialState.text;
  handler.metaInfos = initialState.metaInfos;

  handler.gen = ((name: any, options: any) => {
    return handler`${gen(name, options)}`;
  }) as any;

  return handler;
};
export const createSglModel = (
  url: string,
  options?: CreateSglModelOptions
): InitializedModel =>
  createSglModelRecursive(url, options ?? {}, {
    captured: {},
    text: "",
    metaInfos: [],
  });
