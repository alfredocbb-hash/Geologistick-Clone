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
          created_at: string | null
          direccion: string
          email: string | null
          id: string
          limite_credito: number | null
          nombre: string
          notas: string | null
          saldo_cuenta_corriente: number | null
          sucursal_id: string | null
          telefono: string
          tiene_cuenta_corriente: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          apellido?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          direccion: string
          email?: string | null
          id?: string
          limite_credito?: number | null
          nombre: string
          notas?: string | null
          saldo_cuenta_corriente?: number | null
          sucursal_id?: string | null
          telefono: string
          tiene_cuenta_corriente?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          apellido?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          direccion?: string
          email?: string | null
          id?: string
          limite_credito?: number | null
          nombre?: string
          notas?: string | null
          saldo_cuenta_corriente?: number | null
          sucursal_id?: string | null
          telefono?: string
          tiene_cuenta_corriente?: boolean | null
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
        ]
      }
      comisiones: {
        Row: {
          chofer_id: string
          created_at: string | null
          envio_id: string | null
          id: string
          liquidacion_id: string | null
          monto: number
          monto_fijo_aplicado: number | null
          porcentaje_aplicado: number | null
        }
        Insert: {
          chofer_id: string
          created_at?: string | null
          envio_id?: string | null
          id?: string
          liquidacion_id?: string | null
          monto: number
          monto_fijo_aplicado?: number | null
          porcentaje_aplicado?: number | null
        }
        Update: {
          chofer_id?: string
          created_at?: string | null
          envio_id?: string | null
          id?: string
          liquidacion_id?: string | null
          monto?: number
          monto_fijo_aplicado?: number | null
          porcentaje_aplicado?: number | null
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
            foreignKeyName: "fk_comisiones_liquidacion"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones"
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
          chofer_id: string | null
          created_at: string | null
          created_by: string | null
          descripcion: string | null
          destinatario_id: string | null
          dimensiones: string | null
          estado: Database["public"]["Enums"]["shipment_status"] | null
          fecha_entrega: string | null
          fecha_recogida: string | null
          firma_destinatario: string | null
          foto_entrega: string | null
          id: string
          notas: string | null
          pago_contra_entrega: boolean | null
          peso_kg: number | null
          precio_total: number
          remitente_id: string | null
          sucursal_destino_id: string | null
          sucursal_origen_id: string | null
          tarifa_id: string | null
          tipo_pago: string | null
          tracking_number: string
          updated_at: string | null
          valor_declarado: number | null
        }
        Insert: {
          chofer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          destinatario_id?: string | null
          dimensiones?: string | null
          estado?: Database["public"]["Enums"]["shipment_status"] | null
          fecha_entrega?: string | null
          fecha_recogida?: string | null
          firma_destinatario?: string | null
          foto_entrega?: string | null
          id?: string
          notas?: string | null
          pago_contra_entrega?: boolean | null
          peso_kg?: number | null
          precio_total: number
          remitente_id?: string | null
          sucursal_destino_id?: string | null
          sucursal_origen_id?: string | null
          tarifa_id?: string | null
          tipo_pago?: string | null
          tracking_number: string
          updated_at?: string | null
          valor_declarado?: number | null
        }
        Update: {
          chofer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          destinatario_id?: string | null
          dimensiones?: string | null
          estado?: Database["public"]["Enums"]["shipment_status"] | null
          fecha_entrega?: string | null
          fecha_recogida?: string | null
          firma_destinatario?: string | null
          foto_entrega?: string | null
          id?: string
          notas?: string | null
          pago_contra_entrega?: boolean | null
          peso_kg?: number | null
          precio_total?: number
          remitente_id?: string | null
          sucursal_destino_id?: string | null
          sucursal_origen_id?: string | null
          tarifa_id?: string | null
          tipo_pago?: string | null
          tracking_number?: string
          updated_at?: string | null
          valor_declarado?: number | null
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
            foreignKeyName: "envios_sucursal_origen_id_fkey"
            columns: ["sucursal_origen_id"]
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
        ]
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
          updated_at?: string | null
        }
        Relationships: []
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
        ]
      }
      profiles: {
        Row: {
          activo: boolean | null
          apellido: string | null
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          nombre: string
          sucursal_id: string | null
          telefono: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          apellido?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          nombre: string
          sucursal_id?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          apellido?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nombre?: string
          sucursal_id?: string | null
          telefono?: string | null
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
      sucursales: {
        Row: {
          activa: boolean | null
          created_at: string | null
          direccion: string
          email: string | null
          horario_apertura: string | null
          horario_cierre: string | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          direccion: string
          email?: string | null
          horario_apertura?: string | null
          horario_cierre?: string | null
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          direccion?: string
          email?: string | null
          horario_apertura?: string | null
          horario_cierre?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tarifa_concepto_precios: {
        Row: {
          concepto_id: string
          created_at: string | null
          id: string
          monto: number
          tarifa_id: string
        }
        Insert: {
          concepto_id: string
          created_at?: string | null
          id?: string
          monto?: number
          tarifa_id: string
        }
        Update: {
          concepto_id?: string
          created_at?: string | null
          id?: string
          monto?: number
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
          id: string
          nombre: string
          orden: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
          precio_por_kg: number | null
          precio_por_km: number | null
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
          precio_por_kg?: number | null
          precio_por_km?: number | null
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
          precio_por_kg?: number | null
          precio_por_km?: number | null
          updated_at?: string | null
          zona_destino?: string | null
          zona_origen?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_sucursal: {
        Args: { _sucursal_id: string; _user_id: string }
        Returns: boolean
      }
      generate_tracking_number: { Args: never; Returns: string }
      get_user_sucursal: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
      cash_session_status: "abierta" | "cerrada" | "pendiente_aprobacion"
      payment_method: "efectivo" | "mercado_pago" | "transferencia"
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
      ],
      cash_session_status: ["abierta", "cerrada", "pendiente_aprobacion"],
      payment_method: ["efectivo", "mercado_pago", "transferencia"],
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
