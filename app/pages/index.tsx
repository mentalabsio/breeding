/** @jsxImportSource theme-ui */

import Header from "@/components/Header/Header"
import { PlusSign } from "@/components/icons"
import { LoadingIcon } from "@/components/icons/LoadingIcon"
import NFTSelectInput from "@/components/NFTSelectInput/NFTSelectInput"
import { useBreeding } from "@/hooks/useBreeding/useBreeding"
import useWalletNFTs from "@/hooks/useWalletNFTs"
import { web3 } from "@project-serum/anchor"
import { useAnchorWallet } from "@solana/wallet-adapter-react"
import { Button, Flex, Heading, Text } from "@theme-ui/components"
import Head from "next/head"
import { useEffect } from "react"

export default function Home() {
  const anchorWallet = useAnchorWallet()
  const { walletNFTs, fetchNFTs } = useWalletNFTs([
    "9bBjPXwFVzPSEA4BH2wFfDnzYTekQq6itf6JBNvzRW2C",
  ])
  const {
    initializeBreeding,
    terminateBreeding,
    onMint,
    breedingMachineAccount,
    userBreedDatas,
    feedbackStatus,
    userTokenBalance,
  } = useBreeding()

  /** Just log some info on mount */
  useEffect(() => {
    if (breedingMachineAccount) {
      const feeToken =
        breedingMachineAccount?.config.initializationFeeToken.toString()
      const breedingTime =
        breedingMachineAccount?.config.breedingTime.toNumber()

      const configInfo = breedingMachineAccount && {
        feeToken,
        breedingTime,
        burnParents: breedingMachineAccount?.config.burnParents,
        bred: breedingMachineAccount.bred.toNumber(),
        born: breedingMachineAccount.born.toNumber(),
      }

      console.log(configInfo)
    }
  }, [breedingMachineAccount])

  const cost = breedingMachineAccount?.config.initializationFeePrice.toNumber()

  return (
    <>
      <Head>
        <title>Nifty Nanas Breeding</title>
        <meta
          name="description"
          content="Nifty Nanas Breeding created by MagicShards"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />
      <main
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          maxWidth: "78rem",
          margin: "0 auto",
          padding: "0 1.6rem",
        }}
      >
        <Flex
          sx={{
            justifyContent: "center",
            alignItems: "center",
            background: (props) => props.colors.background,
            alignSelf: "stretch",
            padding: "1.6rem 0",
            margin: "3.2rem 0",
            gap: "3.2rem",

            flexDirection: "column",

            "@media (min-width: 768px)": {
              flexDirection: "row",
            },
          }}
        >
          <Flex
            sx={{
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Heading
              sx={{
                letterSpacing: "-2px",
                textShadow: "0 3px 12px rgb(0 0 0 / 13%)",
                fontSize: "4rem",

                // "-webkit-background-clip": "text",

                // "-webkit-text-fill-color": "transparent",
                backgroundImage: (props) => props.colors.primaryGradient2,
                backgroundClip: "text",
                color: "transparent",
                // background: (props) => props.colors.primaryGradient,
              }}
              mb=".8rem"
              variant="heading1"
            >
              Breed your Nanas
            </Heading>
            <Text>Get a brand new Baby Nana from two OG Nanas!</Text>
          </Flex>

          <Flex
            sx={{
              alignItems: "center",
              gap: ".8rem",
            }}
          >
            {/* <img
              sx={{
                maxWidth: "24rem",
              }}
              src="/babynana1.png"
              alt="Baby Nana"
              title="Baby Nana"
            /> */}
            <img
              sx={{
                maxWidth: "16rem",
              }}
              src="/babynana2.png"
              alt="Baby Nana"
              title="Baby Nana"
            />
          </Flex>
        </Flex>
        {/* 
        <Button onClick={initializeBreedingMachine}>initialize</Button> */}

        {/* {breedingMachineAccount && (
          <>
            <hr />
            {}
            <Text>Fee token: {feeToken}</Text>
            <Text>Breeding duration: {breedingTime} seconds</Text>
            <Text>
              Burn parents:{" "}
              {breedingMachineAccount?.config.burnParents ? "Yes" : "No"}
            </Text>
            <hr />
            <Text>
              Total breeding: {breedingMachineAccount.bred.toNumber()}
            </Text>
            <Text>Total born: {breedingMachineAccount.born.toNumber()}</Text>
          </>
        )} */}

        <Flex
          my="3.2rem"
          sx={{
            flexDirection: "column",
            gap: "1.6rem",
            alignSelf: "stretch",
          }}
        >
          <Flex
            sx={{
              flexDirection: "column",
              gap: ".8rem",
              alignItems: "center",
            }}
          >
            <Heading variant="heading2" mb="1.6rem">
              Select two Nifty Nanas to breed:
            </Heading>

            <form
              onSubmit={async (e) => {
                e.preventDefault()

                const data = new FormData(e.currentTarget)
                const mints = data.getAll("mint").filter((val) => val)

                if (!anchorWallet?.publicKey) return true

                if (mints.length !== 2) return true

                const res = await initializeBreeding(
                  new web3.PublicKey(mints[0]),
                  new web3.PublicKey(mints[1])
                )

                await fetchNFTs()

                return res
              }}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3.2rem",
              }}
            >
              <Flex
                sx={{
                  gap: "1.6rem",
                  flexDirection: "column",
                  alignItems: "center",

                  "@media (min-width: 768px)": {
                    flexDirection: "row",
                  },
                }}
              >
                <NFTSelectInput name="mint" NFTs={walletNFTs} />

                <PlusSign
                  sx={{
                    width: "3.2rem",
                    height: "3.2rem",
                    stroke: "text",
                    strokeWidth: ".2rem",
                  }}
                />

                <NFTSelectInput name="mint" NFTs={walletNFTs} />
              </Flex>
              <Flex
                sx={{
                  flexDirection: "column",
                  alignItems: "center",
                  gap: ".8rem",
                }}
              >
                {cost && anchorWallet?.publicKey ? (
                  <Text>
                    {cost && "Cost: " + cost} | Your Balance:{" "}
                    {userTokenBalance || "0"}
                  </Text>
                ) : (
                  <>&nbsp; </>
                )}
                <Button
                  sx={{
                    alignSelf: "center",
                  }}
                  type="submit"
                >
                  breed!
                </Button>
                <Flex
                  sx={{
                    alignItems: "center",
                    gap: ".8rem",
                    margin: "1.6rem 0",
                    minHeight: "2.4rem",
                  }}
                >
                  {feedbackStatus && (
                    <>
                      {feedbackStatus !== "Success!" && <LoadingIcon />}

                      <Text
                        sx={{
                          color:
                            feedbackStatus === "Success!" ? "success" : "text",
                        }}
                      >
                        {feedbackStatus}
                      </Text>
                    </>
                  )}{" "}
                  &nbsp;
                </Flex>
              </Flex>
            </form>

            <Heading variant="heading2" mt="4.8rem" mb=".8rem">
              Your current breedings
            </Heading>
            {/* <Flex
              sx={{
                alignItems: "center",
                gap: ".8rem",
                margin: "1.6rem 0",
              }}
            >
              {alertState.message && (
                <>
                  {alertState.severity !== "success" && <LoadingIcon />}

                  <Text
                    sx={{
                      color:
                        alertState.severity === "success" ? "success" : "text",
                    }}
                  >
                    {alertState.message}
                  </Text>
                </>
              )}{" "}
              &nbsp;
            </Flex> */}
            <Flex
              sx={{
                flexDirection: "column",
                alignItems: "center",
                minHeight: "2.4rem",
                alignSelf: "stretch",
              }}
            >
              {userBreedDatas ? (
                userBreedDatas.length ? (
                  userBreedDatas.map((breedData) => {
                    return (
                      <Flex
                        key={breedData.breedData.timestamp}
                        sx={{
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "1.6rem",
                          margin: "1.6rem 0",
                          justifyContent: "space-between",
                          alignSelf: "stretch",

                          paddingBottom: "1.6rem",

                          borderColor: "text",

                          "&:not(:last-child)": {
                            borderBottom: "1px solid",
                          },

                          "@media (min-width: 768px)": {
                            flexDirection: "row",
                          },
                        }}
                      >
                        <Flex
                          sx={{
                            alignItems: "center",
                            gap: ".8rem",
                          }}
                        >
                          <Flex
                            sx={{
                              alignItems: "center",
                              gap: "1.6rem",
                            }}
                          >
                            <img
                              src={
                                breedData.metadatas[0].externalMetadata.image
                              }
                              sx={{
                                maxHeight: "6.4rem",
                              }}
                            />
                            {breedData.metadatas[0].externalMetadata.name}
                          </Flex>
                          <PlusSign
                            sx={{
                              width: "1.6rem",
                              height: "1.6rem",
                              stroke: "text",
                              strokeWidth: ".2rem",
                            }}
                          />
                          <Flex
                            sx={{
                              alignItems: "center",
                              gap: "1.6rem",
                            }}
                          >
                            <img
                              src={
                                breedData.metadatas[1].externalMetadata.image
                              }
                              sx={{
                                maxHeight: "6.4rem",
                              }}
                            />
                            {breedData.metadatas[1].externalMetadata.name}
                          </Flex>
                        </Flex>
                        <Button
                          sx={{
                            marginLeft: "1.6rem",
                          }}
                          variant="secondary"
                          onClick={async () => {
                            await terminateBreeding(
                              breedData.breedData.mintA,
                              breedData.breedData.mintB
                            )

                            await fetchNFTs()
                          }}
                        >
                          Terminate
                        </Button>
                      </Flex>
                    )
                  })
                ) : (
                  <Text>Empty.</Text>
                )
              ) : anchorWallet?.publicKey ? (
                <LoadingIcon />
              ) : (
                <Text>Connect your wallet first.</Text>
              )}
            </Flex>

            {/* <Text
              variant="small"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                margin: "1.6rem 0",
              }}
            >
              <Button variant="resetted" onClick={onMint}>
                click here
              </Button>{" "}
              <Text variant="xsmall">to mint manually</Text>
            </Text> */}
          </Flex>
        </Flex>
      </main>

      <footer
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          margin: "4rem 0",
        }}
      >
        Powered by{" "}
        <a
          href="https://twitter.com/magicshards"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <Text
            variant="small"
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <img
              sx={{
                height: "32px",
              }}
              src="/magicshards320px.gif"
              alt="Magic Shards"
              height={32}
            />
            MagicShards
          </Text>
        </a>
      </footer>
    </>
  )
}
