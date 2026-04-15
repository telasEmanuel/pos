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
  EnvioMateriales,
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
      layout: MainLayout,
    },
  },
  {
    path: '/carrito',
    component: CarritoPage,
    meta: {
      title: 'Carrito de Compras',
      layout: MainLayout,
    },
  },
  {
    path: '/corte',
    component: CortePage,
    meta: {
      title: 'Corte de Caja',
      layout: MainLayout,
    },
  },
  {
    path: '/reporte',
    component: ReporteExistencias,
    meta: {
      title: 'Reporte de Existencias',
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
      layout: MainLayout,
    },
  },
  {
    path: '/categorias',
    component: categoriesPage,
    meta: {
      title: 'Categorías de productos',
      layout: MainLayout,
    },
  },
  {
    path: '/secciones',
    component: Secciones,
    meta: {
      title: 'Gestión de Secciones',
      layout: MainLayout,
    },
  },
  {
    path: '/productos',
    component: Productos,
    meta: {
      title: 'Opciones de Bodega',
      layout: MainLayout,
    },
  },
  {
    path: '/usuarios',
    component: UsersPage,
    meta: {
      title: 'Ver usuarios del sistema',
      layout: MainLayout,
    },
  },
  {
    path: '/ordenes',
    component: Ordenes,
    meta: {
      title: 'Consultar ordenes de compra',
      layout: MainLayout,
    },
  },
  {
    path: '/ventas',
    component: Ventas,
    meta: {
      title: 'Salidas de productos',
      layout: MainLayout,
    },
  },
  {
    path: '/proveedores',
    component: Proveedores,
    meta: {
      title: 'Gestionar proveedores',
      layout: MainLayout,
    },
  },
  {
    path: '/calculadora',
    component: Calculadora,
    meta: {
      title: 'Calculadora de precios',
      layout: MainLayout,
    },
  },
  {
    path: '/transferencias',
    component: EnvioMateriales,
    meta: {
      title: 'Transferencias de inventario',
      layout: MainLayout,
    },
  },
  {
    path: '/historial',
    component: Historial,
    meta: {
      title: 'Historial de movimientos',
      layout: MainLayout,
    },
  },
  {
    path: '/tickets',
    component: ImpresionesPage,
    meta: {
      title: 'Autorizaciones del personal',
      layout: MainLayout,
    },
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
