import { GoogleGenAI, Type } from "@google/genai";
import { CVData, Opportunity, UserProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  async parseCV(text: string): Promise<Partial<CVData['parsedData']>> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following CV text into a structured JSON format:
      ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            email: { type: Type.STRING },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  company: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  description: { type: Type.STRING },
                }
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  degree: { type: Type.STRING },
                  school: { type: Type.STRING },
                  year: { type: Type.STRING },
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  },

  async getCVHealthScore(cvContent: string) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this CV and provide a health score (0-100) for ATS Readability, Impact, Skills, and Formatting. Also provide 3 actionable suggestions.
      CV: ${cvContent}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.NUMBER },
            atsReadability: { type: Type.NUMBER },
            impact: { type: Type.NUMBER },
            skills: { type: Type.NUMBER },
            formatting: { type: Type.NUMBER },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  },

  async searchOpportunities(query: string, type: 'job' | 'scholarship' | 'visa'): Promise<Opportunity[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find 5 ${type} opportunities for the following query: ${query}. 
      Provide realistic but simulated data for this demo. Include title, organization, location, description, requirements (list), link, and deadline.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              organization: { type: Type.STRING },
              location: { type: Type.STRING },
              description: { type: Type.STRING },
              requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
              link: { type: Type.STRING },
              deadline: { type: Type.STRING },
              matchScore: { type: Type.NUMBER }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "[]").map((item: any) => ({ ...item, type }));
  },

  async tailorCV(cvContent: string, jobDescription: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tailor this CV to match the following job description. Focus on keywords and impact.
      CV: ${cvContent}
      Job: ${jobDescription}`,
    });
    return response.text || "";
  },

  async generateCoverLetter(cvContent: string, jobDescription: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a professional cover letter based on this CV and job description.
      CV: ${cvContent}
      Job: ${jobDescription}`,
    });
    return response.text || "";
  }
};
