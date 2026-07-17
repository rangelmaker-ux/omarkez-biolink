export type SiteSettingsRow = {
  id: number;
  handle: string;
  subtitle: string;
  footer_text: string;
  accent_color: string;
  motion_enabled: boolean;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type CardRow = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  button_label: string;
  kind: "link" | "download";
  image_url: string | null;
  external_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  open_in_new_tab: boolean;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};
