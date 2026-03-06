import { Injectable } from "@nestjs/common";
import { DbService } from "../../common/db.service";

@Injectable()
export class UtilsService {
  constructor(private readonly db: DbService) {}

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

  async getPublicSettings(): Promise<{ gtm_id: string }> {
    try {
      const res = await this.db.client.query(
        `SELECT data FROM app_settings WHERE id = 1`
      );
      
      if (res.rows.length === 0) {
        return { gtm_id: "" };
      }

      const settings = res.rows[0].data || {};
      const analytics = settings.analytics || {};
      const gtmId = typeof analytics.gtm_id === "string" ? analytics.gtm_id : "";
      
      return { gtm_id: gtmId };
    } catch (error) {
      return { gtm_id: "" };
    }
  }
}
