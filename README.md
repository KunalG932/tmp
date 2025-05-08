# tmp - File Hosting Service

A simple and clean file hosting application that uses the [envs.sh](https://envs.sh) API for storing files. This application allows you to upload files up to 512 MB, set custom expiration times, and provides a nice UI with upload progress tracking.

## Features

- Upload files up to 512 MB
- Custom file expiration settings (in hours)
- File drag and drop support
- File paste support (paste from clipboard)
- Upload progress bar
- Dark/Light theme support
- Mobile responsive design

## Changes from Original Repository

This repository is a fork of [qewertyy/tmp](https://github.com/qewertyy/tmp) with the following enhancements:

- Changed the backend API from qewertyy's custom API to [envs.sh](https://envs.sh)
- Increased maximum file size from 100 MB to 512 MB
- Added file expiration options
- Added upload progress bar
- Improved file selection UI with better feedback
- Added support for default expiration (use "0" for default retention period)

## Development

Run the dev server:

```shellscript
npm run dev
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

## Tech Stack

- [Remix](https://remix.run)
- [React](https://reactjs.org)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [envs.sh API](https://envs.sh) for file hosting

## About the envs.sh API

Files uploaded through this service:
- Are valid for at least 30 days and up to 90 days depending on file size
- Can have custom expiration times by setting the "expires" parameter (in hours)
- Can be deleted using the X-Token returned from the API

---

Original README content below:

---

# Welcome to Remix!

- 📖 [Remix docs](https://remix.run/docs)

## Development

Run the dev server:

```shellscript
npm run dev
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying Node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `npm run build`

- `build/server`
- `build/client`

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.
