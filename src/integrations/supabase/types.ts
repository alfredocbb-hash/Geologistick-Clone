export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      arca_config: {
        Row: {
          condicion_iva: string
          created_at: string | null
          cuit: string
          domicilio_comercial: string | null
          environment: string | null
          factura_a_habilitada: boolean | null
          factura_b_habilitada: boolean | null
          factura_c_habilitada: boolean | null
          id: string
          inicio_actividades: string | null
          is_active: boolean | null
          punto_venta: number
          razon_social: string
          tenant_id: string | null
          ultimo_numero_a: number | null
          ultimo_numero_b: number | null
          ultimo_numero_c: number | null
          updated_at: string | null
        }
        Insert: {
          condicion_iva: string
          created_at?: string | null
          cuit: string
          domicilio_comercial?: string | null
          environment?: string | null
          factura_a_habilitada?: boolean | null
          factura_b_habilitada?: boolean | null
          factura_c_habilitada?: boolean | null
          id?: string
          inicio_actividades?: string | null
          is_active?: boolean | null
          punto_venta: number
          razon_social: string
          tenant_id?: string | null
          ultimo_numero_a?: number | null
          ultimo_numero_b?: number | null
          ultimo_numero_c?: number | null
          updated_at?: string | null
        }
        Update: {
          condicion_iva?: string
          created_at?: string | null
          cuit?: string
          domicilio_comercial?: string | null
          environment?: string | null
          factura_a_habilitada?: boolean | null
          factura_b_habilitada?: boolean | null
          factura_c_habilitada?: boolean | null
          id?: string
          inicio_actividades?: string | null
          is_active?: boolean | null
          punto_venta?: number
          razon_social?: string
          tenant_id?: string | null
          ultimo_numero_a?: number | null
          ultimo_numero_b?: number | null
          ultimo_numero_c?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arca_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_cuenta_corriente: {
        Row: {
          cliente_id: string
          created_at: string | null
          created_by: string | null
          descripcion: string | null
          envio_id: string | null
          id: string
          monto: number
          saldo_anterior: number
          saldo_nuevo: number
          tipo: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          envio_id?: string | null
          id?: string
          monto: number
          saldo_anterior?: number
          saldo_nuevo?: number
          tipo: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          envio_id?: string | null
          id?: string
          monto?: number
          saldo_anterior?: number
          saldo_nuevo?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_cuenta_corriente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_cuenta_corriente_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          apellido: string | null
          ciudad: string | null
          codigo_postal: string | null
          condicion_iva: string | null
          created_at: string | null
          direccion: string
          dni_cuit: string | null
          email: string | null
          id: string
          lat: number | null
          limite_credito: number | null
          lng: number | null
          nombre: string
          notas: string | null
          razon_social: string | null
          saldo_cuenta_corriente: number | null
          sucursal_id: string | null
          telefono: string
          tenant_id: string | null
          tiene_cuenta_corriente: boolean | null
          tipo_contribuyente: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          apellido?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          condicion_iva?: string | null
          created_at?: string | null
          direccion: string
          dni_cuit?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          limite_credito?: number | null
          lng?: number | null
          nombre: string
          notas?: string | null
          razon_social?: string | null
          saldo_cuenta_corriente?: number | null
          sucursal_id?: string | null
          telefono: string
          tenant_id?: string | null
          tiene_cuenta_corriente?: boolean | null
          tipo_contribuyente?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          apellido?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          condicion_iva?: string | null
          created_at?: string | null
          direccion?: string
          dni_cuit?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          limite_credito?: number | null
          lng?: number | null
          nombre?: string
          notas?: string | null
          razon_social?: string | null
          saldo_cuenta_corriente?: number | null
          sucursal_id?: string | null
          telefono?: string
          tenant_id?: string | null
          tiene_cuenta_corriente?: boolean | null
          tipo_contribuyente?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      comisiones: {
        Row: {
          chofer_id: string
          created_at: string | null
          editado_at: string | null
          editado_por: string | null
          envio_id: string | null
          id: string
          liquidacion_id: string | null
          monto: number
          monto_fijo_aplicado: number | null
          monto_original: number | null
          porcentaje_aplicado: number | null
          tenant_id: string | null
          tipo: string | null
        }
        Insert: {
          chofer_id: string
          created_at?: string | null
          editado_at?: string | null
          editado_por?: string | null
          envio_id?: string | null
          id?: string
          liquidacion_id?: string | null
          monto: number
          monto_fijo_aplicado?: number | null
          monto_original?: number | null
          porcentaje_aplicado?: number | null
          tenant_id?: string | null
          tipo?: string | null
        }
        Update: {
          chofer_id?: string
          created_at?: string | null
          editado_at?: string | null
          editado_por?: string | null
          envio_id?: string | null
          id?: string
          liquidacion_id?: string | null
          monto?: number
          monto_fijo_aplicado?: number | null
          monto_original?: number | null
          porcentaje_aplicado?: number | null
          tenant_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comisiones_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comisiones_liquidacion"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_seguro: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          porcentaje_excedente: number
          seguro_base: number
          tenant_id: string | null
          updated_at: string | null
          valor_maximo_asegurado: number
          valor_minimo_declarado: number
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          porcentaje_excedente?: number
          seguro_base?: number
          tenant_id?: string | null
          updated_at?: string | null
          valor_maximo_asegurado?: number
          valor_minimo_declarado?: number
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          porcentaje_excedente?: number
          seguro_base?: number
          tenant_id?: string | null
          updated_at?: string | null
          valor_maximo_asegurado?: number
          valor_minimo_declarado?: number
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_seguro_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_location_history: {
        Row: {
          accuracy: number | null
          chofer_id: string
          heading: number | null
          hoja_ruta_id: string | null
          id: string
          lat: number
          lng: number
          recorded_at: string | null
          ruta_id: string | null
          speed: number | null
          tenant_id: string | null
        }
        Insert: {
          accuracy?: number | null
          chofer_id: string
          heading?: number | null
          hoja_ruta_id?: string | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string | null
          ruta_id?: string | null
          speed?: number | null
          tenant_id?: string | null
        }
        Update: {
          accuracy?: number | null
          chofer_id?: string
          heading?: number | null
          hoja_ruta_id?: string | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string | null
          ruta_id?: string | null
          speed?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_location_history_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_location_history_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas_planificadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_location_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          chofer_id: string
          id: string
          lat: number
          lng: number
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          chofer_id: string
          id?: string
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          chofer_id?: string
          id?: string
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: []
      }
      ecommerce_orders: {
        Row: {
          buyer_dni: string | null
          buyer_email: string | null
          buyer_name: string
          buyer_phone: string | null
          created_at: string | null
          envio_id: string | null
          external_order_id: string
          external_order_number: string | null
          fulfillment_status: string | null
          id: string
          items: Json | null
          order_status: string | null
          payment_status: string | null
          plataforma: string
          raw_data: Json | null
          seller_id: string
          shipping_address: string
          shipping_city: string | null
          shipping_cost: number | null
          shipping_lat: number | null
          shipping_lng: number | null
          shipping_notes: string | null
          shipping_postal_code: string | null
          shipping_province: string | null
          subtotal: number | null
          synced_at: string | null
          tenant_id: string
          total: number | null
          updated_at: string | null
        }
        Insert: {
          buyer_dni?: string | null
          buyer_email?: string | null
          buyer_name: string
          buyer_phone?: string | null
          created_at?: string | null
          envio_id?: string | null
          external_order_id: string
          external_order_number?: string | null
          fulfillment_status?: string | null
          id?: string
          items?: Json | null
          order_status?: string | null
          payment_status?: string | null
          plataforma: string
          raw_data?: Json | null
          seller_id: string
          shipping_address: string
          shipping_city?: string | null
          shipping_cost?: number | null
          shipping_lat?: number | null
          shipping_lng?: number | null
          shipping_notes?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          subtotal?: number | null
          synced_at?: string | null
          tenant_id: string
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          buyer_dni?: string | null
          buyer_email?: string | null
          buyer_name?: string
          buyer_phone?: string | null
          created_at?: string | null
          envio_id?: string | null
          external_order_id?: string
          external_order_number?: string | null
          fulfillment_status?: string | null
          id?: string
          items?: Json | null
          order_status?: string | null
          payment_status?: string | null
          plataforma?: string
          raw_data?: Json | null
          seller_id?: string
          shipping_address?: string
          shipping_city?: string | null
          shipping_cost?: number | null
          shipping_lat?: number | null
          shipping_lng?: number | null
          shipping_notes?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          subtotal?: number | null
          synced_at?: string | null
          tenant_id?: string
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_orders_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_sellers: {
        Row: {
          access_token: string | null
          activo: boolean | null
          ciudad: string | null
          codigo_postal: string | null
          created_at: string | null
          created_by: string | null
          cuit: string | null
          dias_retiro: string[] | null
          direccion: string | null
          email: string
          express_delivery_days: number | null
          express_surcharge: number | null
          horario_retiro: string | null
          id: string
          limite_credito: number | null
          max_delivery_days: number | null
          min_delivery_days: number | null
          nombre: string
          permite_pickup: boolean | null
          pickup_surcharge: number | null
          plataforma: string
          provincia: string | null
          razon_social: string | null
          refresh_token: string | null
          saldo_cuenta_corriente: number | null
          shipping_carrier_id: string | null
          store_id: string | null
          store_url: string | null
          sucursal_pickup_id: string | null
          tarifa_express_id: string | null
          tarifa_id: string | null
          telefono: string | null
          tenant_id: string
          tiene_cuenta_corriente: boolean | null
          token_expires_at: string | null
          ultimo_sync: string | null
          updated_at: string | null
          user_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          activo?: boolean | null
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          created_by?: string | null
          cuit?: string | null
          dias_retiro?: string[] | null
          direccion?: string | null
          email: string
          express_delivery_days?: number | null
          express_surcharge?: number | null
          horario_retiro?: string | null
          id?: string
          limite_credito?: number | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          nombre: string
          permite_pickup?: boolean | null
          pickup_surcharge?: number | null
          plataforma?: string
          provincia?: string | null
          razon_social?: string | null
          refresh_token?: string | null
          saldo_cuenta_corriente?: number | null
          shipping_carrier_id?: string | null
          store_id?: string | null
          store_url?: string | null
          sucursal_pickup_id?: string | null
          tarifa_express_id?: string | null
          tarifa_id?: string | null
          telefono?: string | null
          tenant_id: string
          tiene_cuenta_corriente?: boolean | null
          token_expires_at?: string | null
          ultimo_sync?: string | null
          updated_at?: string | null
          user_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          activo?: boolean | null
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          created_by?: string | null
          cuit?: string | null
          dias_retiro?: string[] | null
          direccion?: string | null
          email?: string
          express_delivery_days?: number | null
          express_surcharge?: number | null
          horario_retiro?: string | null
          id?: string
          limite_credito?: number | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          nombre?: string
          permite_pickup?: boolean | null
          pickup_surcharge?: number | null
          plataforma?: string
          provincia?: string | null
          razon_social?: string | null
          refresh_token?: string | null
          saldo_cuenta_corriente?: number | null
          shipping_carrier_id?: string | null
          store_id?: string | null
          store_url?: string | null
          sucursal_pickup_id?: string | null
          tarifa_express_id?: string | null
          tarifa_id?: string | null
          telefono?: string | null
          tenant_id?: string
          tiene_cuenta_corriente?: boolean | null
          token_expires_at?: string | null
          ultimo_sync?: string | null
          updated_at?: string | null
          user_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_sellers_sucursal_pickup_id_fkey"
            columns: ["sucursal_pickup_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_sellers_tarifa_express_id_fkey"
            columns: ["tarifa_express_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_sellers_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_sellers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_terciarizadas: {
        Row: {
          activa: boolean | null
          ciudad: string | null
          codigo: string
          codigo_postal: string | null
          created_at: string | null
          created_by: string | null
          cuit: string | null
          direccion: string | null
          email: string | null
          id: string
          limite_credito: number | null
          nombre: string
          notas: string | null
          provincia: string | null
          razon_social: string | null
          saldo_cuenta_corriente: number | null
          telefono: string | null
          tenant_id: string | null
          tiene_cuenta_corriente: boolean | null
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          ciudad?: string | null
          codigo: string
          codigo_postal?: string | null
          created_at?: string | null
          created_by?: string | null
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          limite_credito?: number | null
          nombre: string
          notas?: string | null
          provincia?: string | null
          razon_social?: string | null
          saldo_cuenta_corriente?: number | null
          telefono?: string | null
          tenant_id?: string | null
          tiene_cuenta_corriente?: boolean | null
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          ciudad?: string | null
          codigo?: string
          codigo_postal?: string | null
          created_at?: string | null
          created_by?: string | null
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          limite_credito?: number | null
          nombre?: string
          notas?: string | null
          provincia?: string | null
          razon_social?: string | null
          saldo_cuenta_corriente?: number | null
          telefono?: string | null
          tenant_id?: string | null
          tiene_cuenta_corriente?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_terciarizadas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      envio_detalles: {
        Row: {
          concepto_id: string | null
          created_at: string | null
          envio_id: string
          id: string
          monto: number
          nombre_concepto: string
        }
        Insert: {
          concepto_id?: string | null
          created_at?: string | null
          envio_id: string
          id?: string
          monto?: number
          nombre_concepto: string
        }
        Update: {
          concepto_id?: string | null
          created_at?: string | null
          envio_id?: string
          id?: string
          monto?: number
          nombre_concepto?: string
        }
        Relationships: [
          {
            foreignKeyName: "envio_detalles_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "tarifa_conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envio_detalles_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
        ]
      }
      envio_historial: {
        Row: {
          created_at: string | null
          created_by: string | null
          envio_id: string
          estado_anterior: Database["public"]["Enums"]["shipment_status"] | null
          estado_nuevo: Database["public"]["Enums"]["shipment_status"]
          id: string
          notas: string | null
          ubicacion: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          envio_id: string
          estado_anterior?:
            | Database["public"]["Enums"]["shipment_status"]
            | null
          estado_nuevo: Database["public"]["Enums"]["shipment_status"]
          id?: string
          notas?: string | null
          ubicacion?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          envio_id?: string
          estado_anterior?:
            | Database["public"]["Enums"]["shipment_status"]
            | null
          estado_nuevo?: Database["public"]["Enums"]["shipment_status"]
          id?: string
          notas?: string | null
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "envio_historial_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
        ]
      }
      envios: {
        Row: {
          alto_cm: number | null
          ancho_cm: number | null
          cantidad_bultos: number | null
          chofer_id: string | null
          chofer_ultima_milla_id: string | null
          ciudad_entrega: string | null
          ciudad_retiro: string | null
          codigo_cliente_externo: string | null
          codigo_orden_externo: string | null
          codigo_postal_destino: string | null
          codigo_postal_origen: string | null
          cp_entrega: string | null
          cp_retiro: string | null
          created_at: string | null
          created_by: string | null
          descripcion: string | null
          destinatario_id: string | null
          destinatario_lat: number | null
          destinatario_lng: number | null
          dias_preferidos_entrega: string[] | null
          dimensiones: string | null
          direccion_entrega: string | null
          direccion_retiro: string | null
          distancia_km: number | null
          dni_destinatario: string | null
          dni_remitente: string | null
          dni_retira: string | null
          duracion_estimada_minutos: number | null
          empresa_terciarizada: string | null
          empresa_terciarizada_id: string | null
          entrega_lat: number | null
          entrega_lng: number | null
          entregado_en_sucursal: boolean | null
          entregado_por: string | null
          es_terciarizado: boolean | null
          estado: Database["public"]["Enums"]["shipment_status"] | null
          estado_retiro: string | null
          factura_cae: string | null
          factura_fecha: string | null
          factura_numero: string | null
          factura_tipo: string | null
          fecha_asignacion_ultima_milla: string | null
          fecha_entrega: string | null
          fecha_recogida: string | null
          fecha_retiro: string | null
          firma_destinatario: string | null
          foto_entrega: string | null
          horario_preferido_entrega: string | null
          horario_retiro: string | null
          id: string
          largo_cm: number | null
          nombre_destinatario: string | null
          nombre_remitente: string | null
          nombre_retira: string | null
          notas: string | null
          notas_retiro: string | null
          pago_contra_entrega: boolean | null
          parentesco_retira: string | null
          peso_kg: number | null
          precio_total: number
          provincia: string | null
          remitente_id: string | null
          remitente_lat: number | null
          remitente_lng: number | null
          reprogramado_count: number | null
          requiere_factura: boolean | null
          requiere_retiro: boolean | null
          retira_firma: string | null
          retira_foto: string | null
          rotulo_generado: boolean | null
          rotulo_generado_at: string | null
          sucursal_destino_id: string | null
          sucursal_entrega_id: string | null
          sucursal_origen_id: string | null
          sucursal_retiro_id: string | null
          tarifa_id: string | null
          tarifa_metodo_aplicado: string | null
          tenant_id: string | null
          tipo_pago: string | null
          tipo_servicio: string | null
          tipo_servicio_detalle: string | null
          tracking_externo: string | null
          tracking_number: string
          ultima_reprogramacion: string | null
          updated_at: string | null
          valor_declarado: number | null
          volumen_m3: number | null
          whatsapp_destinatario: string | null
        }
        Insert: {
          alto_cm?: number | null
          ancho_cm?: number | null
          cantidad_bultos?: number | null
          chofer_id?: string | null
          chofer_ultima_milla_id?: string | null
          ciudad_entrega?: string | null
          ciudad_retiro?: string | null
          codigo_cliente_externo?: string | null
          codigo_orden_externo?: string | null
          codigo_postal_destino?: string | null
          codigo_postal_origen?: string | null
          cp_entrega?: string | null
          cp_retiro?: string | null
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          destinatario_id?: string | null
          destinatario_lat?: number | null
          destinatario_lng?: number | null
          dias_preferidos_entrega?: string[] | null
          dimensiones?: string | null
          direccion_entrega?: string | null
          direccion_retiro?: string | null
          distancia_km?: number | null
          dni_destinatario?: string | null
          dni_remitente?: string | null
          dni_retira?: string | null
          duracion_estimada_minutos?: number | null
          empresa_terciarizada?: string | null
          empresa_terciarizada_id?: string | null
          entrega_lat?: number | null
          entrega_lng?: number | null
          entregado_en_sucursal?: boolean | null
          entregado_por?: string | null
          es_terciarizado?: boolean | null
          estado?: Database["public"]["Enums"]["shipment_status"] | null
          estado_retiro?: string | null
          factura_cae?: string | null
          factura_fecha?: string | null
          factura_numero?: string | null
          factura_tipo?: string | null
          fecha_asignacion_ultima_milla?: string | null
          fecha_entrega?: string | null
          fecha_recogida?: string | null
          fecha_retiro?: string | null
          firma_destinatario?: string | null
          foto_entrega?: string | null
          horario_preferido_entrega?: string | null
          horario_retiro?: string | null
          id?: string
          largo_cm?: number | null
          nombre_destinatario?: string | null
          nombre_remitente?: string | null
          nombre_retira?: string | null
          notas?: string | null
          notas_retiro?: string | null
          pago_contra_entrega?: boolean | null
          parentesco_retira?: string | null
          peso_kg?: number | null
          precio_total: number
          provincia?: string | null
          remitente_id?: string | null
          remitente_lat?: number | null
          remitente_lng?: number | null
          reprogramado_count?: number | null
          requiere_factura?: boolean | null
          requiere_retiro?: boolean | null
          retira_firma?: string | null
          retira_foto?: string | null
          rotulo_generado?: boolean | null
          rotulo_generado_at?: string | null
          sucursal_destino_id?: string | null
          sucursal_entrega_id?: string | null
          sucursal_origen_id?: string | null
          sucursal_retiro_id?: string | null
          tarifa_id?: string | null
          tarifa_metodo_aplicado?: string | null
          tenant_id?: string | null
          tipo_pago?: string | null
          tipo_servicio?: string | null
          tipo_servicio_detalle?: string | null
          tracking_externo?: string | null
          tracking_number: string
          ultima_reprogramacion?: string | null
          updated_at?: string | null
          valor_declarado?: number | null
          volumen_m3?: number | null
          whatsapp_destinatario?: string | null
        }
        Update: {
          alto_cm?: number | null
          ancho_cm?: number | null
          cantidad_bultos?: number | null
          chofer_id?: string | null
          chofer_ultima_milla_id?: string | null
          ciudad_entrega?: string | null
          ciudad_retiro?: string | null
          codigo_cliente_externo?: string | null
          codigo_orden_externo?: string | null
          codigo_postal_destino?: string | null
          codigo_postal_origen?: string | null
          cp_entrega?: string | null
          cp_retiro?: string | null
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          destinatario_id?: string | null
          destinatario_lat?: number | null
          destinatario_lng?: number | null
          dias_preferidos_entrega?: string[] | null
          dimensiones?: string | null
          direccion_entrega?: string | null
          direccion_retiro?: string | null
          distancia_km?: number | null
          dni_destinatario?: string | null
          dni_remitente?: string | null
          dni_retira?: string | null
          duracion_estimada_minutos?: number | null
          empresa_terciarizada?: string | null
          empresa_terciarizada_id?: string | null
          entrega_lat?: number | null
          entrega_lng?: number | null
          entregado_en_sucursal?: boolean | null
          entregado_por?: string | null
          es_terciarizado?: boolean | null
          estado?: Database["public"]["Enums"]["shipment_status"] | null
          estado_retiro?: string | null
          factura_cae?: string | null
          factura_fecha?: string | null
          factura_numero?: string | null
          factura_tipo?: string | null
          fecha_asignacion_ultima_milla?: string | null
          fecha_entrega?: string | null
          fecha_recogida?: string | null
          fecha_retiro?: string | null
          firma_destinatario?: string | null
          foto_entrega?: string | null
          horario_preferido_entrega?: string | null
          horario_retiro?: string | null
          id?: string
          largo_cm?: number | null
          nombre_destinatario?: string | null
          nombre_remitente?: string | null
          nombre_retira?: string | null
          notas?: string | null
          notas_retiro?: string | null
          pago_contra_entrega?: boolean | null
          parentesco_retira?: string | null
          peso_kg?: number | null
          precio_total?: number
          provincia?: string | null
          remitente_id?: string | null
          remitente_lat?: number | null
          remitente_lng?: number | null
          reprogramado_count?: number | null
          requiere_factura?: boolean | null
          requiere_retiro?: boolean | null
          retira_firma?: string | null
          retira_foto?: string | null
          rotulo_generado?: boolean | null
          rotulo_generado_at?: string | null
          sucursal_destino_id?: string | null
          sucursal_entrega_id?: string | null
          sucursal_origen_id?: string | null
          sucursal_retiro_id?: string | null
          tarifa_id?: string | null
          tarifa_metodo_aplicado?: string | null
          tenant_id?: string | null
          tipo_pago?: string | null
          tipo_servicio?: string | null
          tipo_servicio_detalle?: string | null
          tracking_externo?: string | null
          tracking_number?: string
          ultima_reprogramacion?: string | null
          updated_at?: string | null
          valor_declarado?: number | null
          volumen_m3?: number | null
          whatsapp_destinatario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "envios_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_empresa_terciarizada_id_fkey"
            columns: ["empresa_terciarizada_id"]
            isOneToOne: false
            referencedRelation: "empresas_terciarizadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_remitente_id_fkey"
            columns: ["remitente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_sucursal_destino_id_fkey"
            columns: ["sucursal_destino_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_sucursal_entrega_id_fkey"
            columns: ["sucursal_entrega_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_sucursal_origen_id_fkey"
            columns: ["sucursal_origen_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_sucursal_retiro_id_fkey"
            columns: ["sucursal_retiro_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          arca_response: Json | null
          cae: string | null
          cae_vencimiento: string | null
          created_at: string | null
          created_by: string | null
          envio_id: string | null
          error_mensaje: string | null
          estado: string | null
          fecha_emision: string | null
          id: string
          importe_iva: number | null
          importe_neto: number
          importe_total: number
          numero_comprobante: number
          pdf_url: string | null
          punto_venta: number
          receptor_condicion_iva: string | null
          receptor_cuit: string | null
          receptor_domicilio: string | null
          receptor_nombre: string | null
          tenant_id: string | null
          tipo_comprobante: string
        }
        Insert: {
          arca_response?: Json | null
          cae?: string | null
          cae_vencimiento?: string | null
          created_at?: string | null
          created_by?: string | null
          envio_id?: string | null
          error_mensaje?: string | null
          estado?: string | null
          fecha_emision?: string | null
          id?: string
          importe_iva?: number | null
          importe_neto: number
          importe_total: number
          numero_comprobante: number
          pdf_url?: string | null
          punto_venta: number
          receptor_condicion_iva?: string | null
          receptor_cuit?: string | null
          receptor_domicilio?: string | null
          receptor_nombre?: string | null
          tenant_id?: string | null
          tipo_comprobante: string
        }
        Update: {
          arca_response?: Json | null
          cae?: string | null
          cae_vencimiento?: string | null
          created_at?: string | null
          created_by?: string | null
          envio_id?: string | null
          error_mensaje?: string | null
          estado?: string | null
          fecha_emision?: string | null
          id?: string
          importe_iva?: number | null
          importe_neto?: number
          importe_total?: number
          numero_comprobante?: number
          pdf_url?: string | null
          punto_venta?: number
          receptor_condicion_iva?: string | null
          receptor_cuit?: string | null
          receptor_domicilio?: string | null
          receptor_nombre?: string | null
          tenant_id?: string | null
          tipo_comprobante?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_ajustes_tarifas: {
        Row: {
          aplicado_por: string | null
          conceptos_afectados: Json | null
          created_at: string | null
          id: string
          notas: string | null
          opciones_aplicadas: Json | null
          porcentaje_aplicado: number
          tarifas_afectadas: Json | null
          tenant_id: string | null
        }
        Insert: {
          aplicado_por?: string | null
          conceptos_afectados?: Json | null
          created_at?: string | null
          id?: string
          notas?: string | null
          opciones_aplicadas?: Json | null
          porcentaje_aplicado: number
          tarifas_afectadas?: Json | null
          tenant_id?: string | null
        }
        Update: {
          aplicado_por?: string | null
          conceptos_afectados?: Json | null
          created_at?: string | null
          id?: string
          notas?: string | null
          opciones_aplicadas?: Json | null
          porcentaje_aplicado?: number
          tarifas_afectadas?: Json | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_ajustes_tarifas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_ruta_envios: {
        Row: {
          created_at: string | null
          envio_id: string
          estado: string | null
          hoja_ruta_id: string
          id: string
          orden: number | null
          recibido_at: string | null
        }
        Insert: {
          created_at?: string | null
          envio_id: string
          estado?: string | null
          hoja_ruta_id: string
          id?: string
          orden?: number | null
          recibido_at?: string | null
        }
        Update: {
          created_at?: string | null
          envio_id?: string
          estado?: string | null
          hoja_ruta_id?: string
          id?: string
          orden?: number | null
          recibido_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_ruta_envios_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_envios_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hojas_ruta: {
        Row: {
          cantidad_envios: number | null
          chofer_id: string | null
          created_at: string | null
          created_by: string | null
          distancia_total_km: number | null
          estado: string | null
          fecha_llegada_estimada: string | null
          fecha_llegada_real: string | null
          fecha_salida: string | null
          fin_real: string | null
          id: string
          inicio_real: string | null
          notas: string | null
          numero: string
          recibido_por: string | null
          sucursal_destino_id: string
          sucursal_origen_id: string
          tenant_id: string | null
          tiempo_estimado_horas: number | null
          updated_at: string | null
          vehiculo_id: string | null
        }
        Insert: {
          cantidad_envios?: number | null
          chofer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          distancia_total_km?: number | null
          estado?: string | null
          fecha_llegada_estimada?: string | null
          fecha_llegada_real?: string | null
          fecha_salida?: string | null
          fin_real?: string | null
          id?: string
          inicio_real?: string | null
          notas?: string | null
          numero: string
          recibido_por?: string | null
          sucursal_destino_id: string
          sucursal_origen_id: string
          tenant_id?: string | null
          tiempo_estimado_horas?: number | null
          updated_at?: string | null
          vehiculo_id?: string | null
        }
        Update: {
          cantidad_envios?: number | null
          chofer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          distancia_total_km?: number | null
          estado?: string | null
          fecha_llegada_estimada?: string | null
          fecha_llegada_real?: string | null
          fecha_salida?: string | null
          fin_real?: string | null
          id?: string
          inicio_real?: string | null
          notas?: string | null
          numero?: string
          recibido_por?: string | null
          sucursal_destino_id?: string
          sucursal_origen_id?: string
          tenant_id?: string | null
          tiempo_estimado_horas?: number | null
          updated_at?: string | null
          vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hojas_ruta_sucursal_destino_id_fkey"
            columns: ["sucursal_destino_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hojas_ruta_sucursal_origen_id_fkey"
            columns: ["sucursal_origen_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hojas_ruta_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hojas_ruta_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes: {
        Row: {
          chofer_id: string
          created_at: string
          descripcion: string | null
          envio_id: string | null
          estado: string
          foto_evidencia: string | null
          id: string
          resolucion: string | null
          tenant_id: string | null
          tipo: string
        }
        Insert: {
          chofer_id: string
          created_at?: string
          descripcion?: string | null
          envio_id?: string | null
          estado?: string
          foto_evidencia?: string | null
          id?: string
          resolucion?: string | null
          tenant_id?: string | null
          tipo: string
        }
        Update: {
          chofer_id?: string
          created_at?: string
          descripcion?: string | null
          envio_id?: string | null
          estado?: string
          foto_evidencia?: string | null
          id?: string
          resolucion?: string | null
          tenant_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidentes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_content: {
        Row: {
          content: Json
          id: string
          section: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: Json
          id?: string
          section: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          section?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      liquidacion_sucursal_detalles: {
        Row: {
          comision_aplicada: number
          created_at: string | null
          envio_id: string
          id: string
          liquidacion_id: string
          monto_envio: number
          tipo_pago: string
        }
        Insert: {
          comision_aplicada: number
          created_at?: string | null
          envio_id: string
          id?: string
          liquidacion_id: string
          monto_envio: number
          tipo_pago: string
        }
        Update: {
          comision_aplicada?: number
          created_at?: string | null
          envio_id?: string
          id?: string
          liquidacion_id?: string
          monto_envio?: number
          tipo_pago?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidacion_sucursal_detalles_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidacion_sucursal_detalles_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones_sucursal"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones: {
        Row: {
          aprobado_por: string | null
          cantidad_envios: number | null
          chofer_id: string
          created_at: string | null
          estado: Database["public"]["Enums"]["settlement_status"] | null
          fecha_pago: string | null
          generado_por: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["payment_method"] | null
          monto_total: number
          notas: string | null
          periodo_fin: string
          periodo_inicio: string
          referencia_pago: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          aprobado_por?: string | null
          cantidad_envios?: number | null
          chofer_id: string
          created_at?: string | null
          estado?: Database["public"]["Enums"]["settlement_status"] | null
          fecha_pago?: string | null
          generado_por?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["payment_method"] | null
          monto_total: number
          notas?: string | null
          periodo_fin: string
          periodo_inicio: string
          referencia_pago?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aprobado_por?: string | null
          cantidad_envios?: number | null
          chofer_id?: string
          created_at?: string | null
          estado?: Database["public"]["Enums"]["settlement_status"] | null
          fecha_pago?: string | null
          generado_por?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["payment_method"] | null
          monto_total?: number
          notas?: string | null
          periodo_fin?: string
          periodo_inicio?: string
          referencia_pago?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones_cliente: {
        Row: {
          cliente_id: string
          created_at: string | null
          created_by: string | null
          estado: string | null
          id: string
          notas: string | null
          periodo_fin: string
          periodo_inicio: string
          saldo_anterior: number | null
          saldo_final: number | null
          tenant_id: string | null
          total_cargos: number | null
          total_pagos: number | null
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          created_by?: string | null
          estado?: string | null
          id?: string
          notas?: string | null
          periodo_fin: string
          periodo_inicio: string
          saldo_anterior?: number | null
          saldo_final?: number | null
          tenant_id?: string | null
          total_cargos?: number | null
          total_pagos?: number | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          created_by?: string | null
          estado?: string | null
          id?: string
          notas?: string | null
          periodo_fin?: string
          periodo_inicio?: string
          saldo_anterior?: number | null
          saldo_final?: number | null
          tenant_id?: string | null
          total_cargos?: number | null
          total_pagos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidaciones_cliente_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones_seller: {
        Row: {
          aprobado_por: string | null
          cantidad_movimientos: number | null
          created_at: string | null
          estado: string | null
          fecha_pago: string | null
          generado_por: string | null
          id: string
          metodo_pago: string | null
          notas: string | null
          periodo_fin: string
          periodo_inicio: string
          referencia_pago: string | null
          saldo_anterior: number | null
          saldo_final: number | null
          saldo_periodo: number | null
          seller_id: string
          tenant_id: string | null
          total_cargos: number | null
          total_pagos: number | null
          updated_at: string | null
        }
        Insert: {
          aprobado_por?: string | null
          cantidad_movimientos?: number | null
          created_at?: string | null
          estado?: string | null
          fecha_pago?: string | null
          generado_por?: string | null
          id?: string
          metodo_pago?: string | null
          notas?: string | null
          periodo_fin: string
          periodo_inicio: string
          referencia_pago?: string | null
          saldo_anterior?: number | null
          saldo_final?: number | null
          saldo_periodo?: number | null
          seller_id: string
          tenant_id?: string | null
          total_cargos?: number | null
          total_pagos?: number | null
          updated_at?: string | null
        }
        Update: {
          aprobado_por?: string | null
          cantidad_movimientos?: number | null
          created_at?: string | null
          estado?: string | null
          fecha_pago?: string | null
          generado_por?: string | null
          id?: string
          metodo_pago?: string | null
          notas?: string | null
          periodo_fin?: string
          periodo_inicio?: string
          referencia_pago?: string | null
          saldo_anterior?: number | null
          saldo_final?: number | null
          saldo_periodo?: number | null
          seller_id?: string
          tenant_id?: string | null
          total_cargos?: number | null
          total_pagos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_seller_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidaciones_seller_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones_sucursal: {
        Row: {
          aprobado_por: string | null
          created_at: string | null
          created_by: string | null
          estado: string | null
          fecha_pago: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["payment_method"] | null
          notas: string | null
          periodo_fin: string
          periodo_inicio: string
          referencia_pago: string | null
          saldo: number | null
          sucursal_id: string
          tenant_id: string | null
          total_cobrado: number | null
          total_comisiones: number | null
          updated_at: string | null
        }
        Insert: {
          aprobado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          estado?: string | null
          fecha_pago?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["payment_method"] | null
          notas?: string | null
          periodo_fin: string
          periodo_inicio: string
          referencia_pago?: string | null
          saldo?: number | null
          sucursal_id: string
          tenant_id?: string | null
          total_cobrado?: number | null
          total_comisiones?: number | null
          updated_at?: string | null
        }
        Update: {
          aprobado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          estado?: string | null
          fecha_pago?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["payment_method"] | null
          notas?: string | null
          periodo_fin?: string
          periodo_inicio?: string
          referencia_pago?: string | null
          saldo?: number | null
          sucursal_id?: string
          tenant_id?: string | null
          total_cobrado?: number | null
          total_comisiones?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_sucursal_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidaciones_sucursal_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_caja: {
        Row: {
          concepto: string
          created_at: string | null
          created_by: string | null
          envio_id: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["payment_method"]
          monto: number
          referencia: string | null
          sesion_caja_id: string
          tipo: string
        }
        Insert: {
          concepto: string
          created_at?: string | null
          created_by?: string | null
          envio_id?: string | null
          id?: string
          metodo_pago: Database["public"]["Enums"]["payment_method"]
          monto: number
          referencia?: string | null
          sesion_caja_id: string
          tipo: string
        }
        Update: {
          concepto?: string
          created_at?: string | null
          created_by?: string | null
          envio_id?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["payment_method"]
          monto?: number
          referencia?: string | null
          sesion_caja_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_sesion_caja_id_fkey"
            columns: ["sesion_caja_id"]
            isOneToOne: false
            referencedRelation: "sesiones_caja"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          tenant_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          tenant_id?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          tenant_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          created_by: string | null
          envio_id: string | null
          estado: Database["public"]["Enums"]["payment_status"] | null
          id: string
          mercado_pago_id: string | null
          mercado_pago_status: string | null
          metodo: Database["public"]["Enums"]["payment_method"]
          monto: number
          notas: string | null
          referencia: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          envio_id?: string | null
          estado?: Database["public"]["Enums"]["payment_status"] | null
          id?: string
          mercado_pago_id?: string | null
          mercado_pago_status?: string | null
          metodo: Database["public"]["Enums"]["payment_method"]
          monto: number
          notas?: string | null
          referencia?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          envio_id?: string | null
          estado?: Database["public"]["Enums"]["payment_status"] | null
          id?: string
          mercado_pago_id?: string | null
          mercado_pago_status?: string | null
          metodo?: Database["public"]["Enums"]["payment_method"]
          monto?: number
          notas?: string | null
          referencia?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean | null
          apellido: string | null
          avatar_url: string | null
          comision_fija: number | null
          comision_notas: string | null
          comision_porcentaje: number | null
          comision_retiro_fija: number | null
          comision_retiro_porcentaje: number | null
          comision_retiro_tipo: string | null
          comision_tipo: string | null
          created_at: string | null
          email: string
          id: string
          nombre: string
          sucursal_id: string | null
          telefono: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          apellido?: string | null
          avatar_url?: string | null
          comision_fija?: number | null
          comision_notas?: string | null
          comision_porcentaje?: number | null
          comision_retiro_fija?: number | null
          comision_retiro_porcentaje?: number | null
          comision_retiro_tipo?: string | null
          comision_tipo?: string | null
          created_at?: string | null
          email: string
          id?: string
          nombre: string
          sucursal_id?: string | null
          telefono?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          apellido?: string | null
          avatar_url?: string | null
          comision_fija?: number | null
          comision_notas?: string | null
          comision_porcentaje?: number | null
          comision_retiro_fija?: number | null
          comision_retiro_porcentaje?: number | null
          comision_retiro_tipo?: string | null
          comision_tipo?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nombre?: string
          sucursal_id?: string | null
          telefono?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          permission_key: string
          permission_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          permission_key: string
          permission_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          permission_key?: string
          permission_name?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      ruta_frecuente_paradas: {
        Row: {
          ciudad: string | null
          cliente_id: string | null
          created_at: string | null
          direccion: string | null
          id: string
          lat: number | null
          lng: number | null
          notas: string | null
          orden: number
          ruta_frecuente_id: string
          tipo: string
        }
        Insert: {
          ciudad?: string | null
          cliente_id?: string | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notas?: string | null
          orden: number
          ruta_frecuente_id: string
          tipo?: string
        }
        Update: {
          ciudad?: string | null
          cliente_id?: string | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notas?: string | null
          orden?: number
          ruta_frecuente_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruta_frecuente_paradas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruta_frecuente_paradas_ruta_frecuente_id_fkey"
            columns: ["ruta_frecuente_id"]
            isOneToOne: false
            referencedRelation: "rutas_frecuentes"
            referencedColumns: ["id"]
          },
        ]
      }
      ruta_paradas: {
        Row: {
          completada_at: string | null
          created_at: string | null
          direccion: string | null
          envio_id: string
          estado: string | null
          hora_estimada: string | null
          id: string
          lat: number | null
          lng: number | null
          notas: string | null
          orden: number
          ruta_id: string
          tipo: string
        }
        Insert: {
          completada_at?: string | null
          created_at?: string | null
          direccion?: string | null
          envio_id: string
          estado?: string | null
          hora_estimada?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notas?: string | null
          orden: number
          ruta_id: string
          tipo: string
        }
        Update: {
          completada_at?: string | null
          created_at?: string | null
          direccion?: string | null
          envio_id?: string
          estado?: string | null
          hora_estimada?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notas?: string | null
          orden?: number
          ruta_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruta_paradas_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruta_paradas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas_planificadas"
            referencedColumns: ["id"]
          },
        ]
      }
      rutas_frecuentes: {
        Row: {
          activa: boolean | null
          created_at: string | null
          created_by: string | null
          descripcion: string | null
          id: string
          nombre: string
          sucursal_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          sucursal_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          sucursal_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rutas_frecuentes_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_frecuentes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rutas_planificadas: {
        Row: {
          chofer_id: string | null
          created_at: string | null
          created_by: string | null
          distancia_total_km: number | null
          estado: string | null
          fecha: string
          hora_inicio: string | null
          id: string
          notas: string | null
          numero: string
          paradas_completadas: number | null
          sucursal_id: string | null
          tenant_id: string | null
          tiempo_estimado_minutos: number | null
          tipo: string | null
          total_paradas: number | null
          updated_at: string | null
          vehiculo_id: string | null
        }
        Insert: {
          chofer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          distancia_total_km?: number | null
          estado?: string | null
          fecha: string
          hora_inicio?: string | null
          id?: string
          notas?: string | null
          numero: string
          paradas_completadas?: number | null
          sucursal_id?: string | null
          tenant_id?: string | null
          tiempo_estimado_minutos?: number | null
          tipo?: string | null
          total_paradas?: number | null
          updated_at?: string | null
          vehiculo_id?: string | null
        }
        Update: {
          chofer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          distancia_total_km?: number | null
          estado?: string | null
          fecha?: string
          hora_inicio?: string | null
          id?: string
          notas?: string | null
          numero?: string
          paradas_completadas?: number | null
          sucursal_id?: string | null
          tenant_id?: string | null
          tiempo_estimado_minutos?: number | null
          tipo?: string | null
          total_paradas?: number | null
          updated_at?: string | null
          vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rutas_planificadas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_planificadas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_planificadas_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_cuenta_corriente: {
        Row: {
          created_at: string | null
          created_by: string | null
          descripcion: string | null
          envio_id: string | null
          id: string
          liquidacion_id: string | null
          metodo_pago: string | null
          monto: number
          order_id: string | null
          referencia: string | null
          saldo_anterior: number | null
          saldo_nuevo: number
          seller_id: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          envio_id?: string | null
          id?: string
          liquidacion_id?: string | null
          metodo_pago?: string | null
          monto: number
          order_id?: string | null
          referencia?: string | null
          saldo_anterior?: number | null
          saldo_nuevo: number
          seller_id: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          envio_id?: string | null
          id?: string
          liquidacion_id?: string | null
          metodo_pago?: string | null
          monto?: number
          order_id?: string | null
          referencia?: string | null
          saldo_anterior?: number | null
          saldo_nuevo?: number
          seller_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_cuenta_corriente_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_cuenta_corriente_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones_seller"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_cuenta_corriente_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_cuenta_corriente_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sesiones_caja: {
        Row: {
          aprobado_por: string | null
          created_at: string | null
          diferencia: number | null
          estado: Database["public"]["Enums"]["cash_session_status"] | null
          fecha_apertura: string | null
          fecha_cierre: string | null
          id: string
          monto_esperado: number | null
          monto_final: number | null
          monto_inicial: number
          notas_apertura: string | null
          notas_cierre: string | null
          sucursal_id: string
          usuario_id: string
        }
        Insert: {
          aprobado_por?: string | null
          created_at?: string | null
          diferencia?: number | null
          estado?: Database["public"]["Enums"]["cash_session_status"] | null
          fecha_apertura?: string | null
          fecha_cierre?: string | null
          id?: string
          monto_esperado?: number | null
          monto_final?: number | null
          monto_inicial: number
          notas_apertura?: string | null
          notas_cierre?: string | null
          sucursal_id: string
          usuario_id: string
        }
        Update: {
          aprobado_por?: string | null
          created_at?: string | null
          diferencia?: number | null
          estado?: Database["public"]["Enums"]["cash_session_status"] | null
          fecha_apertura?: string | null
          fecha_cierre?: string | null
          id?: string
          monto_esperado?: number | null
          monto_final?: number | null
          monto_inicial?: number
          notas_apertura?: string | null
          notas_cierre?: string | null
          sucursal_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_caja_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_branches: number
          max_shipments_month: number
          max_users: number
          name: string
          price_monthly: number
          stripe_price_id: string
          stripe_product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_branches: number
          max_shipments_month: number
          max_users: number
          name: string
          price_monthly: number
          stripe_price_id: string
          stripe_product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_branches?: number
          max_shipments_month?: number
          max_users?: number
          name?: string
          price_monthly?: number
          stripe_price_id?: string
          stripe_product_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sucursal_comisiones: {
        Row: {
          concepto_id: string
          created_at: string | null
          id: string
          porcentaje_contado: number | null
          porcentaje_cta_cte: number | null
          porcentaje_destino: number | null
          sucursal_id: string
          updated_at: string | null
        }
        Insert: {
          concepto_id: string
          created_at?: string | null
          id?: string
          porcentaje_contado?: number | null
          porcentaje_cta_cte?: number | null
          porcentaje_destino?: number | null
          sucursal_id: string
          updated_at?: string | null
        }
        Update: {
          concepto_id?: string
          created_at?: string | null
          id?: string
          porcentaje_contado?: number | null
          porcentaje_cta_cte?: number | null
          porcentaje_destino?: number | null
          sucursal_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursal_comisiones_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "tarifa_conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursal_comisiones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursal_conceptos: {
        Row: {
          concepto_id: string
          created_at: string | null
          habilitado: boolean | null
          id: string
          sucursal_id: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          concepto_id: string
          created_at?: string | null
          habilitado?: boolean | null
          id?: string
          sucursal_id: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          concepto_id?: string
          created_at?: string | null
          habilitado?: boolean | null
          id?: string
          sucursal_id?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursal_conceptos_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "tarifa_conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursal_conceptos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursal_conceptos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursal_tarifas: {
        Row: {
          created_at: string | null
          habilitada: boolean | null
          id: string
          sucursal_id: string
          tarifa_id: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          habilitada?: boolean | null
          id?: string
          sucursal_id: string
          tarifa_id: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          habilitada?: boolean | null
          id?: string
          sucursal_id?: string
          tarifa_id?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursal_tarifas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursal_tarifas_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursal_tarifas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursal_zonas: {
        Row: {
          activa: boolean | null
          ciudad: string
          codigo_postal_desde: string | null
          codigo_postal_hasta: string | null
          created_at: string | null
          id: string
          provincia: string | null
          sucursal_id: string
        }
        Insert: {
          activa?: boolean | null
          ciudad: string
          codigo_postal_desde?: string | null
          codigo_postal_hasta?: string | null
          created_at?: string | null
          id?: string
          provincia?: string | null
          sucursal_id: string
        }
        Update: {
          activa?: boolean | null
          ciudad?: string
          codigo_postal_desde?: string | null
          codigo_postal_hasta?: string | null
          created_at?: string | null
          id?: string
          provincia?: string | null
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sucursal_zonas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursales: {
        Row: {
          activa: boolean | null
          centro_logistico_id: string | null
          ciudad: string | null
          codigo: string | null
          created_at: string | null
          direccion: string
          email: string | null
          es_centro_logistico: boolean | null
          horario_apertura: string | null
          horario_cierre: string | null
          id: string
          lat: number | null
          lng: number | null
          nombre: string
          permite_retiro_clientes: boolean | null
          puede_despachar: boolean | null
          puede_recibir: boolean | null
          realiza_entregas: boolean | null
          realiza_retiros: boolean | null
          telefono: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          centro_logistico_id?: string | null
          ciudad?: string | null
          codigo?: string | null
          created_at?: string | null
          direccion: string
          email?: string | null
          es_centro_logistico?: boolean | null
          horario_apertura?: string | null
          horario_cierre?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nombre: string
          permite_retiro_clientes?: boolean | null
          puede_despachar?: boolean | null
          puede_recibir?: boolean | null
          realiza_entregas?: boolean | null
          realiza_retiros?: boolean | null
          telefono?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          centro_logistico_id?: string | null
          ciudad?: string | null
          codigo?: string | null
          created_at?: string | null
          direccion?: string
          email?: string | null
          es_centro_logistico?: boolean | null
          horario_apertura?: string | null
          horario_cierre?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nombre?: string
          permite_retiro_clientes?: boolean | null
          puede_despachar?: boolean | null
          puede_recibir?: boolean | null
          realiza_entregas?: boolean | null
          realiza_retiros?: boolean | null
          telefono?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursales_centro_logistico_id_fkey"
            columns: ["centro_logistico_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_integrations: {
        Row: {
          config_key: string
          config_value: string
          created_at: string | null
          environment:
            | Database["public"]["Enums"]["integration_environment"]
            | null
          id: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string | null
          environment?:
            | Database["public"]["Enums"]["integration_environment"]
            | null
          id?: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string | null
          environment?:
            | Database["public"]["Enums"]["integration_environment"]
            | null
          id?: string
          integration_type?: Database["public"]["Enums"]["integration_type"]
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifa_concepto_precios: {
        Row: {
          concepto_id: string
          created_at: string | null
          es_porcentaje: boolean | null
          id: string
          monto: number
          multiplicar_por_bultos: boolean
          porcentaje: number | null
          tarifa_id: string
        }
        Insert: {
          concepto_id: string
          created_at?: string | null
          es_porcentaje?: boolean | null
          id?: string
          monto?: number
          multiplicar_por_bultos?: boolean
          porcentaje?: number | null
          tarifa_id: string
        }
        Update: {
          concepto_id?: string
          created_at?: string | null
          es_porcentaje?: boolean | null
          id?: string
          monto?: number
          multiplicar_por_bultos?: boolean
          porcentaje?: number | null
          tarifa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifa_concepto_precios_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "tarifa_conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifa_concepto_precios_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifa_conceptos: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string | null
          descripcion: string | null
          es_basico: boolean | null
          id: string
          nombre: string
          orden: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string | null
          descripcion?: string | null
          es_basico?: boolean | null
          id?: string
          nombre: string
          orden?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string | null
          descripcion?: string | null
          es_basico?: boolean | null
          id?: string
          nombre?: string
          orden?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifa_conceptos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas: {
        Row: {
          activa: boolean | null
          comision_chofer_fija: number | null
          comision_chofer_porcentaje: number | null
          created_at: string | null
          id: string
          nombre: string
          precio_base: number
          precio_minimo_flete: number | null
          precio_por_kg: number | null
          precio_por_km: number | null
          precio_por_m3: number | null
          rangos_kg: Json | null
          rangos_precios: Json | null
          tenant_id: string | null
          tipo_tarifa: string | null
          umbral_volumen_cm: number | null
          updated_at: string | null
          zona_destino: string | null
          zona_origen: string | null
        }
        Insert: {
          activa?: boolean | null
          comision_chofer_fija?: number | null
          comision_chofer_porcentaje?: number | null
          created_at?: string | null
          id?: string
          nombre: string
          precio_base: number
          precio_minimo_flete?: number | null
          precio_por_kg?: number | null
          precio_por_km?: number | null
          precio_por_m3?: number | null
          rangos_kg?: Json | null
          rangos_precios?: Json | null
          tenant_id?: string | null
          tipo_tarifa?: string | null
          umbral_volumen_cm?: number | null
          updated_at?: string | null
          zona_destino?: string | null
          zona_origen?: string | null
        }
        Update: {
          activa?: boolean | null
          comision_chofer_fija?: number | null
          comision_chofer_porcentaje?: number | null
          created_at?: string | null
          id?: string
          nombre?: string
          precio_base?: number
          precio_minimo_flete?: number | null
          precio_por_kg?: number | null
          precio_por_km?: number | null
          precio_por_m3?: number | null
          rangos_kg?: Json | null
          rangos_precios?: Json | null
          tenant_id?: string | null
          tipo_tarifa?: string | null
          umbral_volumen_cm?: number | null
          updated_at?: string | null
          zona_destino?: string | null
          zona_origen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_api_keys: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          color_acento: string | null
          color_fondo: string | null
          color_fondo_dark: string | null
          color_primario: string | null
          color_primario_foreground: string | null
          color_secundario: string | null
          color_sidebar: string | null
          color_sidebar_dark: string | null
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_description: string | null
          created_at: string | null
          custom_css: string | null
          custom_domain: string | null
          favicon: string | null
          footer_text: string | null
          id: string
          logo_dark: string | null
          logo_light: string | null
          meta_description: string | null
          meta_title: string | null
          nombre_app: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_twitter: string | null
          social_whatsapp: string | null
          support_email: string | null
          support_phone: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          color_acento?: string | null
          color_fondo?: string | null
          color_fondo_dark?: string | null
          color_primario?: string | null
          color_primario_foreground?: string | null
          color_secundario?: string | null
          color_sidebar?: string | null
          color_sidebar_dark?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_description?: string | null
          created_at?: string | null
          custom_css?: string | null
          custom_domain?: string | null
          favicon?: string | null
          footer_text?: string | null
          id?: string
          logo_dark?: string | null
          logo_light?: string | null
          meta_description?: string | null
          meta_title?: string | null
          nombre_app?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          social_whatsapp?: string | null
          support_email?: string | null
          support_phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color_acento?: string | null
          color_fondo?: string | null
          color_fondo_dark?: string | null
          color_primario?: string | null
          color_primario_foreground?: string | null
          color_secundario?: string | null
          color_sidebar?: string | null
          color_sidebar_dark?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_description?: string | null
          created_at?: string | null
          custom_css?: string | null
          custom_domain?: string | null
          favicon?: string | null
          footer_text?: string | null
          id?: string
          logo_dark?: string | null
          logo_light?: string | null
          meta_description?: string | null
          meta_title?: string | null
          nombre_app?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          social_whatsapp?: string | null
          support_email?: string | null
          support_phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage: {
        Row: {
          branches_count: number | null
          created_at: string | null
          id: string
          month_year: string
          shipments_count: number | null
          tenant_id: string
          updated_at: string | null
          users_count: number | null
        }
        Insert: {
          branches_count?: number | null
          created_at?: string | null
          id?: string
          month_year: string
          shipments_count?: number | null
          tenant_id: string
          updated_at?: string | null
          users_count?: number | null
        }
        Update: {
          branches_count?: number | null
          created_at?: string | null
          id?: string
          month_year?: string
          shipments_count?: number | null
          tenant_id?: string
          updated_at?: string | null
          users_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activo: boolean | null
          color_acento: string | null
          color_primario: string | null
          color_secundario: string | null
          configuracion: Json | null
          created_at: string | null
          ecommerce_config: Json | null
          ecommerce_enabled: boolean | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          max_envios_mes: number | null
          max_sucursales: number | null
          max_usuarios: number | null
          nombre: string
          plan: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          color_acento?: string | null
          color_primario?: string | null
          color_secundario?: string | null
          configuracion?: Json | null
          created_at?: string | null
          ecommerce_config?: Json | null
          ecommerce_enabled?: boolean | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          max_envios_mes?: number | null
          max_sucursales?: number | null
          max_usuarios?: number | null
          nombre: string
          plan?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          color_acento?: string | null
          color_primario?: string | null
          color_secundario?: string | null
          configuracion?: Json | null
          created_at?: string | null
          ecommerce_config?: Json | null
          ecommerce_enabled?: boolean | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          max_envios_mes?: number | null
          max_sucursales?: number | null
          max_usuarios?: number | null
          nombre?: string
          plan?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      terciarizado_cuenta_corriente: {
        Row: {
          created_at: string | null
          created_by: string | null
          descripcion: string | null
          empresa_id: string
          envio_id: string | null
          id: string
          metodo_pago: string | null
          monto: number
          referencia: string | null
          saldo_anterior: number
          saldo_nuevo: number
          tipo: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          empresa_id: string
          envio_id?: string | null
          id?: string
          metodo_pago?: string | null
          monto: number
          referencia?: string | null
          saldo_anterior?: number
          saldo_nuevo?: number
          tipo: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          empresa_id?: string
          envio_id?: string | null
          id?: string
          metodo_pago?: string | null
          monto?: number
          referencia?: string | null
          saldo_anterior?: number
          saldo_nuevo?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "terciarizado_cuenta_corriente_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_terciarizadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terciarizado_cuenta_corriente_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          created_at: string | null
          despachado_por: string | null
          envio_id: string
          estado: string | null
          fecha_despacho: string | null
          fecha_recepcion: string | null
          id: string
          notas: string | null
          recibido_por: string | null
          sucursal_destino_id: string
          sucursal_origen_id: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          despachado_por?: string | null
          envio_id: string
          estado?: string | null
          fecha_despacho?: string | null
          fecha_recepcion?: string | null
          id?: string
          notas?: string | null
          recibido_por?: string | null
          sucursal_destino_id: string
          sucursal_origen_id: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          despachado_por?: string | null
          envio_id?: string
          estado?: string | null
          fecha_despacho?: string | null
          fecha_recepcion?: string | null
          id?: string
          notas?: string | null
          recibido_por?: string | null
          sucursal_destino_id?: string
          sucursal_origen_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_sucursal_destino_id_fkey"
            columns: ["sucursal_destino_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_sucursal_origen_id_fkey"
            columns: ["sucursal_origen_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehiculos: {
        Row: {
          anio: number | null
          capacidad_bultos: number | null
          capacidad_kg: number | null
          chofer_asignado_id: string | null
          created_at: string | null
          estado: string | null
          id: string
          marca: string | null
          modelo: string | null
          notas: string | null
          patente: string
          sucursal_id: string | null
          tenant_id: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          anio?: number | null
          capacidad_bultos?: number | null
          capacidad_kg?: number | null
          chofer_asignado_id?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          notas?: string | null
          patente: string
          sucursal_id?: string | null
          tenant_id?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          anio?: number | null
          capacidad_bultos?: number | null
          capacidad_kg?: number | null
          chofer_asignado_id?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          notas?: string | null
          patente?: string
          sucursal_id?: string | null
          tenant_id?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehiculos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehiculos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actualizar_conceptos_porcentaje: {
        Args: { p_factor: number; p_tarifa_ids: string[] }
        Returns: undefined
      }
      can_access_sucursal: {
        Args: { _sucursal_id: string; _user_id: string }
        Returns: boolean
      }
      close_hoja_ruta: { Args: { p_hoja_id: string }; Returns: Json }
      close_ruta_planificada: { Args: { p_ruta_id: string }; Returns: Json }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_is_super_admin: { Args: never; Returns: boolean }
      current_user_sucursal: { Args: never; Returns: string }
      current_user_tenant: { Args: never; Returns: string }
      generate_hoja_ruta_number: { Args: never; Returns: string }
      generate_ruta_number: { Args: never; Returns: string }
      generate_tracking_number:
        | { Args: never; Returns: string }
        | { Args: { p_sucursal_id?: string }; Returns: string }
      get_or_create_tenant_usage: {
        Args: { p_tenant_id: string }
        Returns: {
          branches_count: number | null
          created_at: string | null
          id: string
          month_year: string
          shipments_count: number | null
          tenant_id: string
          updated_at: string | null
          users_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "tenant_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_tenant_subscription_details: {
        Args: { p_tenant_id: string }
        Returns: {
          cancel_at_period_end: boolean
          current_period_end: string
          max_branches: number
          max_shipments_month: number
          max_users: number
          plan_name: string
          status: string
          stripe_price_id: string
          stripe_product_id: string
          subscription_id: string
        }[]
      }
      get_user_sucursal: { Args: { _user_id: string }; Returns: string }
      get_user_tenant: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      start_hoja_ruta: { Args: { p_hoja_id: string }; Returns: Json }
      start_ruta_planificada: { Args: { p_ruta_id: string }; Returns: Json }
      user_belongs_to_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      validate_api_key: { Args: { p_api_key: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "chofer"
        | "operador"
        | "sucursal"
        | "cliente"
        | "supervisor"
        | "bodega"
        | "atencion_cliente"
        | "despachador"
        | "super_admin"
        | "seller"
      cash_session_status: "abierta" | "cerrada" | "pendiente_aprobacion"
      integration_environment: "sandbox" | "production"
      integration_type:
        | "mercado_pago"
        | "google_maps"
        | "whatsapp"
        | "email_smtp"
        | "sms"
        | "arca"
        | "tiendanube"
      payment_method: "efectivo" | "mercado_pago" | "transferencia" | "tarjeta"
      payment_status: "pendiente" | "pagado" | "fallido" | "reembolsado"
      settlement_status: "generada" | "enviada" | "pagada" | "rechazada"
      shipment_status:
        | "pendiente"
        | "recogido"
        | "en_bodega"
        | "en_transito"
        | "en_reparto"
        | "entregado"
        | "devuelto"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "chofer",
        "operador",
        "sucursal",
        "cliente",
        "supervisor",
        "bodega",
        "atencion_cliente",
        "despachador",
        "super_admin",
        "seller",
      ],
      cash_session_status: ["abierta", "cerrada", "pendiente_aprobacion"],
      integration_environment: ["sandbox", "production"],
      integration_type: [
        "mercado_pago",
        "google_maps",
        "whatsapp",
        "email_smtp",
        "sms",
        "arca",
        "tiendanube",
      ],
      payment_method: ["efectivo", "mercado_pago", "transferencia", "tarjeta"],
      payment_status: ["pendiente", "pagado", "fallido", "reembolsado"],
      settlement_status: ["generada", "enviada", "pagada", "rechazada"],
      shipment_status: [
        "pendiente",
        "recogido",
        "en_bodega",
        "en_transito",
        "en_reparto",
        "entregado",
        "devuelto",
        "cancelado",
      ],
    },
  },
} as const
