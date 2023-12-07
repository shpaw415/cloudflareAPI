/**
 * CLOUDFLARE_TOKEN must be set in .env
 * Make sure your api token is set to perform the requests to the account to the endpoint
 */
class cloudflare {
  private token = process.env.CLOUDFLARE_TOKEN as string;
  private API_Host = "https://api.cloudflare.com/client/v4";

  public DNSRecords: DNSRecords;

  constructor() {
    this.DNSRecords = new DNSRecords(this);
  }
  public async makeCall({
    endpoint,
    data,
    header,
    method,
  }: {
    endpoint: string;
    data?: object;
    header?: { [key: string]: string };
    method?: "POST" | "GET" | "PATCH" | "DELETE" | "PUT";
  }) {
    const res = await fetch(this.API_Host + endpoint, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(header || {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      method: method,
    });
    if (!res.ok) throw new Error("the call failed");
    return await res.json();
  }
}

interface DNSRecordsUpdate {
  zone_id: string;
  set: {
    current_name: string;
    content: string;
    name: string;
    proxied: boolean;
    type: DNSRecordsTypes;
  }[];
}

type DNSRecordsTypes =
  | "A"
  | "AAAA"
  | "CNAME"
  | "MX"
  | "NAPTR"
  | "NS"
  | "PTR"
  | "SOA"
  | "SPF"
  | "SRV"
  | "TXT";

interface DNSRecordData {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
  meta: {
    auto_added: boolean;
    managed_by_apps: boolean;
    managed_by_argo_tunnel: boolean;
    source: string;
  };
  comment: null | string;
  tags: string[];
  created_on: string;
  modified_on: string;
}
interface getDNSRecords {
  result: Array<DNSRecordData>;
  success: true;
  errors: Array<string>;
  messages: Array<string>;
  result_info: {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
    total_pages: number;
  };
}

class DNSRecords {
  private cloudflare: cloudflare;
  private recordList: Array<DNSRecordData> | undefined;
  constructor(cf: cloudflare) {
    this.cloudflare = cf;
  }
  async init({ zone_id }: { zone_id: string }) {
    if (this.recordList) return;
    this.recordList = (
      (await this.get({
        zone_id: zone_id,
      })) as getDNSRecords
    ).result;
  }
  async get({ zone_id }: { zone_id: string }) {
    return (await this.cloudflare.makeCall({
      endpoint: `/zones/${zone_id}/dns_records`,
    })) as getDNSRecords;
  }
  async update(props: DNSRecordsUpdate) {
    await this.init({ zone_id: props.zone_id });

    props.set.map(async (data) => {
      const record_id = this.recordList?.find(
        (rec) => rec.name === data.current_name
      )?.id;
      if (!record_id) throw new Error("name not found");
      await this.cloudflare.makeCall({
        endpoint: `/zones/${props.zone_id}/dns_records/${record_id}`,
        method: "PUT",
        data: (({ current_name, ...o }) => o)(data),
      });
    });
  }
}
