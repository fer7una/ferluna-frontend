import { useEffect, useState } from "react";
import { fallbackSiteData, fetchSiteData } from "../../api";
import type { SiteData } from "../../types";

export function useSiteData() {
  const [siteData, setSiteData] = useState<SiteData>(fallbackSiteData);

  useEffect(() => {
    const controller = new AbortController();

    fetchSiteData(controller.signal)
      .then((data) => {
        setSiteData(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      });

    return () => controller.abort();
  }, []);

  return siteData;
}
