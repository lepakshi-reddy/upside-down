
import { GoogleGenAI, Modality } from "@google/genai";
import { Attachment, Language } from "../types";

const SYSTEM_INSTRUCTION = (lang: Language) => `You are "AgriMate", a world-class agricultural education assistant. 
Your goal is to explain farming concepts to students and rural workers using VERY SIMPLE, EASY-TO-UNDERSTAND language.

CORE PRINCIPLES:
- Use short sentences.
- Avoid complex technical jargon. If you must use a technical term, explain it simply.
- Be encouraging and clear.
- Focus on the "how-to" of crop lifecycles (Sowing, Irrigation, Harvesting, Storage).

LANGUAGES:
- You support English, Hindi (हिन्दी), and Telugu (తెలుగు).
- Currently responding in: ${lang}.

CRITICAL SAFETY RULES:
1. You MUST NEVER recommend any specific fertilizer, pesticide, or chemical treatment by name or brand. 
2. If a user asks about fertilizers, you must explain simply: "AgriMate is here to teach you about how crops grow. I cannot suggest specific fertilizers or chemicals. Please talk to your local farming officer for advice on what chemicals to use."
3. You MUST NEVER provide yield predictions or profit forecasts.
4. You MUST ONLY provide educational info on stages and standard practices.

MULTIMODAL CAPABILITIES:
- If a user provides an image, analyze it. Describe what you see in the simplest way possible. Identify the crop and its growth stage.
- Identify pests or diseases ONLY as general categories without suggesting specific chemicals.
- If a user provides audio, listen and respond helpfully in simple ${lang}.`;

export class AgriGeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async sendMessage(
    history: { role: 'user' | 'model'; parts: any[] }[], 
    message: string, 
    attachments: Attachment[] = [],
    lang: Language = 'en'
  ) {
    const ai = this.getAI();
    const parts: any[] = [{ text: message || "Analyze the attached file." }];
    
    for (const att of attachments) {
      if (att.base64) {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.base64
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history,
        { role: 'user', parts }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION(lang),
        temperature: 0.7,
      }
    });

    return response.text;
  }

  async generateSpeech(text: string) {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this clearly and simply: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  }

  async generateImage(prompt: string) {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `A simple, clear educational drawing of: ${prompt}. Bright colors, easy to see details for farmers.` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  }

  async generateVideo(prompt: string) {
    const ai = this.getAI();
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `A very simple educational animation showing: ${prompt}. High contrast, clear movement, easy to understand.`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
}

export const agriGemini = new AgriGeminiService();
