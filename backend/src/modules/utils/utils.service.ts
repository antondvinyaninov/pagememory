import { Injectable } from "@nestjs/common";

@Injectable()
export class UtilsService {
  private readonly DADATA_API_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";
  private readonly DADATA_TOKEN = process.env.DADATA_TOKEN || "";

  async getCitySuggestions(query: string): Promise<{ suggestions: Array<{ value: string; data: any }> }> {
    if (!this.DADATA_TOKEN) {
      return { suggestions: [] };
    }

    try {
      const requestBody = {
        query: query,
        from_bound: { value: "city" },
        to_bound: { value: "city" },
        locations: [{ country: "*" }],
      };

      const response = await fetch(this.DADATA_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${this.DADATA_TOKEN}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        return { suggestions: [] };
      }

      const data = await response.json();
      return { suggestions: data.suggestions || [] };
    } catch (error) {
      return { suggestions: [] };
    }
  }
}
