export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          parent_id: string | null
          image_url: string | null
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          category_id: string
          price: number
          compare_at_price: number | null
          stock_qty: number
          images: string[]
          status: 'active' | 'draft' | 'out_of_stock' | 'pre_order'
          preorder_ship_date: string | null
          featured: boolean
          brand_id: string | null
          attributes: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      orders: {
        Row: {
          id: string
          order_number: string
          buyer_id: string | null
          buyer_email: string
          buyer_phone: string
          buyer_name: string
          shipping_address: Json
          items: Json
          subtotal: number
          shipping_fee: number
          discount_amount: number
          total: number
          status: 'pending' | 'confirmed' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
          payment_type: 'paystack' | 'cod'
          payment_status: 'pending' | 'paid' | 'awaiting_cod'
          is_preorder: boolean
          pre_order_ship_date: string | null
          payment_method: string | null
          payment_reference: string | null
          paystack_reference: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_events: {
        Row: {
          id: string
          order_id: string
          event: string
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['order_events']['Row'], 'id' | 'created_at'>
        Update: never
      }
      coupons: {
        Row: {
          id: string
          code: string
          type: 'percentage' | 'fixed'
          value: number
          min_order_amount: number | null
          max_uses: number | null
          used_count: number
          expires_at: string | null
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['coupons']['Row'], 'id' | 'created_at' | 'used_count'>
        Update: Partial<Database['public']['Tables']['coupons']['Insert']>
      }
      banners: {
        Row: {
          id: string
          title: string
          subtitle: string | null
          image_url: string
          cta_text: string | null
          cta_link: string | null
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['banners']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['banners']['Insert']>
      }
      flash_sales: {
        Row: {
          id: string
          title: string
          starts_at: string
          ends_at: string
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['flash_sales']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['flash_sales']['Insert']>
      }
      flash_sale_items: {
        Row: {
          id: string
          flash_sale_id: string
          product_id: string
          sale_price: number
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['flash_sale_items']['Row'], 'id'>
        Update: Partial<Omit<Database['public']['Tables']['flash_sale_items']['Insert'], 'flash_sale_id' | 'product_id'>>
      }
      brands: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['brands']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['brands']['Insert']>
      }
      trending_searches: {
        Row: {
          id: string
          query: string
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['trending_searches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['trending_searches']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience row types
export type Category = Database['public']['Tables']['categories']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderEvent = Database['public']['Tables']['order_events']['Row']
export type Coupon = Database['public']['Tables']['coupons']['Row']
export type Banner = Database['public']['Tables']['banners']['Row']
export type FlashSale = Database['public']['Tables']['flash_sales']['Row']
export type FlashSaleItem = Database['public']['Tables']['flash_sale_items']['Row']
export type Brand = Database['public']['Tables']['brands']['Row']
export type TrendingSearch = Database['public']['Tables']['trending_searches']['Row']

// Flash sale with items + joined product data
export interface FlashSaleWithItems extends FlashSale {
  items: Array<FlashSaleItem & { product: Product }>
}

// Order item embedded in orders.items JSON
export interface OrderItem {
  product_id: string
  product_name: string
  product_image: string
  price: number
  quantity: number
  is_preorder: boolean
  preorder_ship_date: string | null
}

export interface SavedAddress {
  id: string
  recipient_name: string
  phone: string
  region: string
  district: string
  city: string
  landmark: string
  digital_address?: string
  is_default: boolean
}

// Ghana address format
export interface GhanaAddress {
  recipient_name: string
  phone: string
  region: string
  district: string
  city: string
  landmark: string
  digital_address?: string // GhanaPostGPS
}
