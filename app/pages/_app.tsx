import Router, { AppProps } from "next/dist/shared/lib/router/router";
import dynamic from "next/dynamic";
import Head from "next/head";
import React from "react";
import { ThemeProvider } from "theme-ui";

import "@solana/wallet-adapter-react-ui/styles.css";

import withGA from "next-ga";
import defaultTheme from "@/styles/theme";

const WalletProvider = dynamic(
  () => import("@/components/WalletProvider/WalletProvider"),
  {
    ssr: false,
  }
);

function App(props: AppProps) {
  const { Component, pageProps } = props;

  return (
    <ThemeProvider theme={defaultTheme}>
      <Head>
        {/** Load font styles directly on the document to prevent flashes */}
        <link href="/fonts/fonts.css" rel="stylesheet" />
      </Head>

      <WalletProvider>
        <Component {...pageProps} />
      </WalletProvider>
    </ThemeProvider>
  );
}

export default withGA(process.env.NEXT_PUBLIC_GA_ID, Router)(App);
