import { register } from 'register-service-worker';

// The ready(), registered(), cached(), updatefound() and updated()
// events passes a ServiceWorkerRegistration instance in their argument.
// ServiceWorkerRegistration: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration

register(process.env.SERVICE_WORKER_FILE || '', {
  // The registrationOptions object and all of its properties are optional.
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

  // once() fires when the service worker has been registered
  ready() {
    // console.log('Service worker is active.')
  },

  // once() fires when the service worker has been registered and it has become the active service worker.
  registered() {
    // console.log('Service worker has been registered.')
  },

  // once() fires if the ServiceWorkerRegistration.onupdatefound property is set to a function.
  cached() {
    // console.log('New content is cached; please refresh.')
  },

  // once() fires if the ServiceWorkerRegistration.installing property is set to a ServiceWorker object.
  // It fires every time a new service worker is being installed.
  updatefound() {
    // console.log('New service worker is installing.')
  },

  // once() fires if the ServiceWorkerRegistration.controller property changes.
  updated() {
    // console.log('New service worker is active; please refresh.')
  },

  // once() fires if the ServiceWorkerRegistration.onupdatefound property is set to a function and the updating service worker throws an error during installation.
  offline() {
    // console.log('No internet connection found. App is running in offline mode.')
  },

  // catch() fires when register() promise is rejected
  error(err: Error) {
    console.error('Error during service worker registration:', err);
  },
});
