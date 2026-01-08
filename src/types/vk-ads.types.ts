export interface VKAdsFastStatResponse {
  banners: {
    [bannerId: string]: {
      timestamp: number;
      minutely: {
        shows: number[];
        clicks: number[];
      };
    };
  };
}

export interface VKAdsSummaryResponse {
  items: Array<{
    id: string;
    total: {
      base: {
        shows: number;
        clicks: number;
        spent: string;
      };
    };
  }>;
}

export interface FastStatRecord {
  timestamp: Date;
  bannerId: number;
  shows: number;
  clicks: number;
}

export interface SummaryStatRecord {
  timestamp: Date;
  bannerId: number;
  shows: number;
  clicks: number;
  spent: number;
}

// Metadata API responses
export interface VKAdsCampaignResponse {
  count: number;
  items: Array<{
    id: string;
    name: string;
    status?: string;
    price?: string;
    delivery?: string;
    created?: string;
    updated?: string;
  }>;
  error?: {
    message: string;
  };
}

export interface VKAdsAdGroupResponse {
  count: number;
  items: Array<{
    id: string;
    name: string;
    ad_plan_id: string;
    status?: string;
  }>;
  error?: {
    message: string;
  };
}

export interface VKAdsBannerResponse {
  count: number;
  items: Array<{
    id: string;
    name: string;
    ad_group_id: string;
    textblocks?: any;
    status?: string;
  }>;
  error?: {
    message: string;
  };
}

// Metadata records for database
export interface CampaignMetaRecord {
  id: number;
  name: string;
  status: string;
}

export interface CampaignHistoryRecord {
  id: number;
  bid: number | null;
  delivery: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdGroupMetaRecord {
  id: number;
  name: string;
  adPlanId: number;
  status: string;
}

export interface BannerMetaRecord {
  id: number;
  name: string;
  adGroupId: number;
  textblocks: string | null;
  status: string;
}
