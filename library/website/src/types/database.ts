export interface Database {
  public: {
    Views: Record<string, never>
    Functions: {
      get_today_apply_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_today_download_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      soft_delete_account: {
        Args: Record<string, never>
        Returns: undefined
      }
      check_rejoin_allowed: {
        Args: { p_email: string }
        Returns: boolean
      }
    }
    Tables: {
      vendors: {
        Row: {
          id: string
          auth_user_id: string
          company_name: string
          category: string | null
          login_id: string | null
          contact_name: string
          contact_phone: string
          approved: boolean
          rejected: boolean
          description: string | null
          address: string | null
          website_url: string | null
          instagram: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          company_name: string
          category?: string | null
          login_id?: string | null
          contact_name: string
          contact_phone: string
          approved?: boolean
          rejected?: boolean
          description?: string | null
          address?: string | null
          website_url?: string | null
          instagram?: string | null
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          company_name?: string
          category?: string | null
          login_id?: string | null
          contact_name?: string
          contact_phone?: string
          approved?: boolean
          rejected?: boolean
          description?: string | null
          address?: string | null
          website_url?: string | null
          instagram?: string | null
          logo_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      folder_nodes: {
        Row: {
          id: string
          vendor_id: string
          parent_id: string | null
          name: string
          depth: number
          is_leaf: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          parent_id?: string | null
          name: string
          depth?: number
          is_leaf?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          parent_id?: string | null
          name?: string
          depth?: number
          is_leaf?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          vendor_id: string
          folder_id: string
          name: string
          unit_price: number | null
          stock: number | null
          origin: string | null
          brand: string | null
          size: string | null
          thumbnail_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          folder_id: string
          name: string
          unit_price?: number | null
          stock?: number | null
          origin?: string | null
          brand?: string | null
          size?: string | null
          thumbnail_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          folder_id?: string
          name?: string
          unit_price?: number | null
          stock?: number | null
          origin?: string | null
          brand?: string | null
          size?: string | null
          thumbnail_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          file_name: string
          storage_path: string
          url: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          file_name: string
          storage_path: string
          url: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          file_name?: string
          storage_path?: string
          url?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          auth_user_id: string
          display_name: string | null
          plan: 'free' | 'pro'
          plan_expires_at: string | null
          trial_used: boolean
          trial_expires_at: string | null
          deleted_at: string | null
          rejoin_available_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          display_name?: string | null
          plan?: 'free' | 'pro'
          plan_expires_at?: string | null
          trial_used?: boolean
          trial_expires_at?: string | null
          deleted_at?: string | null
          rejoin_available_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          display_name?: string | null
          plan?: 'free' | 'pro'
          plan_expires_at?: string | null
          trial_used?: boolean
          trial_expires_at?: string | null
          deleted_at?: string | null
          rejoin_available_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      apply_logs: {
        Row: {
          id: string
          user_id: string
          product_id: string
          applied_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          applied_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          applied_at?: string
        }
        Relationships: []
      }
      download_logs: {
        Row: {
          id: string
          user_id: string
          product_id: string
          downloaded_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          downloaded_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          downloaded_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          product_id: string
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          category: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          category?: string
          created_at?: string
        }
        Relationships: []
      }
    }
  }
}

export type Vendor = Database['public']['Tables']['vendors']['Row']
export type FolderNode = Database['public']['Tables']['folder_nodes']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type ProductImage = Database['public']['Tables']['product_images']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type DownloadLog = Database['public']['Tables']['download_logs']['Row']
