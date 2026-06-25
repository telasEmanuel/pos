import type { RouteRecordRaw } from 'vue-router';
import MainLayout from 'layouts/MainLayout.vue';
import DefaultLayout from 'layouts/DefaultLayout.vue';
import {
  HomePage,
  CatsBodPage,
  CatsTiePage,
  ProdsBodPage,
  ProdsTiePage,
  LoginPage,
  PedidosPage,
  CarritoPage,
  CortePage,
  ReporteExistencias,
  OpcionesBodega,
  Calculadora,
  categoriesPage,
  Proveedores,
  UsersPage,
  Ordenes,
  Ventas,
  Productos,
  DetalleInventario,
  Historial,
  Secciones,
  ImpresionesPage,
} from '../pages/index';

const routes: RouteRecordRaw[] = [
  // {
  //   path: '/',
  //   component: () => import('layouts/MainLayout.vue'),
  //   children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
  // },
  {
    path: '/',
    component: LoginPage,
    meta: {
      title: 'Inicia sesión',
      layout: DefaultLayout,
    },
  },
  {
    path: '/select',
    component: HomePage,
    meta: {
      title: 'Inicio',
      layout: MainLayout,
    },
  },
  {
    path: '/bodega',
    component: CatsBodPage,
    meta: {
      title: 'Inventario de bodega',
      layout: MainLayout,
    },
  },
  {
    path: '/existencias-bodega/:categoryId',
    name: 'ConfiguracionPorCategoria',
    component: ProdsBodPage,
    props: (route) => ({
      categoryId: route.params.categoryId,
      technicalCard: route.query.technicalCard,
      descripcion: route.query.descripcion,
    }),
    meta: {
      title: 'Inventario de bodega',
      layout: MainLayout,
    },
  },
  {
    path: '/tienda',
    component: CatsTiePage,
    meta: {
      title: 'Inventario de tienda',
      layout: MainLayout,
    },
  },
  {
    path: '/existencias-tienda/:categoryId',
    name: 'ConfiguracionPorCategoriaTienda',
    component: ProdsTiePage,
    props: (route) => ({
      categoryId: route.params.categoryId,
      descripcion: route.query.descripcion,
    }),
    meta: {
      title: 'Inventario de tienda',
      layout: MainLayout,
    },
  },
  {
    path: '/caja',
    component: PedidosPage,
    meta: {
      title: 'Pedidos activos',
      permiso: 'pedidos',
      layout: MainLayout,
    },
  },
  {
    path: '/carrito',
    component: CarritoPage,
    meta: {
      title: 'Carrito de Compras',
      permiso: 'carrito',
      layout: MainLayout,
    },
  },
  {
    path: '/corte',
    component: CortePage,
    meta: {
      title: 'Corte de Caja',
      permiso: 'corte_caja',
      layout: MainLayout,
    },
  },
  {
    path: '/reporte',
    component: ReporteExistencias,
    meta: {
      title: 'Reporte de Existencias',
      permiso: 'reporte_existencia',
      layout: MainLayout,
    },
  },
  {
    path: '/moresettings',
    component: OpcionesBodega,
    meta: {
      title: 'Opciones de Bodega',
      layout: MainLayout,
    },
  },
  {
    path: '/detalles-inventario',
    component: DetalleInventario,
    meta: {
      title: 'Detalles de Inventario',
      permiso: 'detalles_inventario',
      layout: MainLayout,
    },
  },
  {
    path: '/categorias',
    component: categoriesPage,
    meta: {
      title: 'Categorías de productos',
      permiso: 'categorias',
      layout: MainLayout,
    },
  },
  {
    path: '/secciones',
    component: Secciones,
    meta: {
      title: 'Gestión de Secciones',
      permiso: 'secciones',
      layout: MainLayout,
    },
  },
  {
    path: '/productos',
    component: Productos,
    meta: {
      title: 'Opciones de Bodega',
      permiso: 'productos',
      layout: MainLayout,
    },
  },
  {
    path: '/usuarios',
    component: UsersPage,
    meta: {
      title: 'Ver usuarios del sistema',
      permiso: 'usuarios',
      layout: MainLayout,
    },
  },
  {
    path: '/ordenes',
    component: Ordenes,
    meta: {
      title: 'Consultar ordenes de compra',
      permiso: 'ordenes',
      layout: MainLayout,
    },
  },
  {
    path: '/ventas',
    component: Ventas,
    meta: {
      title: 'Salidas de productos',
      permiso: 'reporte_ventas',
      layout: MainLayout,
    },
  },
  {
    path: '/proveedores',
    component: Proveedores,
    meta: {
      title: 'Gestionar proveedores',
      permiso: 'proveedores',
      layout: MainLayout,
    },
  },
  {
    path: '/calculadora',
    component: Calculadora,
    meta: {
      title: 'Calculadora de precios',
      permiso: 'calculadora',
      layout: MainLayout,
    },
  },
  {
    path: '/historial',
    component: Historial,
    meta: {
      title: 'Historial de movimientos',
      permiso: 'historial_movimientos',
      layout: MainLayout,
    },
  },
  {
    path: '/tickets',
    component: ImpresionesPage,
    meta: {
      title: 'Autorizaciones del personal',
      permiso: 'tickets',
      layout: MainLayout,
    },
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
