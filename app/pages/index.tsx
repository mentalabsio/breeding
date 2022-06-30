/** @jsxImportSource theme-ui */

import Header from "@/components/Header/Header"
import { PlusSign } from "@/components/icons"
import { LoadingIcon } from "@/components/icons/LoadingIcon"
import NFTSelectInput from "@/components/NFTSelectInput/NFTSelectInput"
import { useBreeding } from "@/hooks/useBreeding/useBreeding"
import useWalletNFTs from "@/hooks/useWalletNFTs"
import { web3 } from "@project-serum/anchor"
import { useAnchorWallet } from "@solana/wallet-adapter-react"
import { Button, Flex, Heading, Text, Alert } from "@theme-ui/components"
import Head from "next/head"
import { useEffect, useMemo, useState } from "react"

const collections = [
  "HjaeGbWfBAYuYyTk9hDK79jquYMTJ6pgrjKnsBogHhQu",
  "DD6JPVzSz3jBiSoQTKUAdqRaQ9M6erhvQgzerU1eqKAd",
]

export default function Home() {
  const anchorWallet = useAnchorWallet()
  const [currentCollectionIndex, setCurrentCollectionIdex] = useState(0)

  const currentCollection = useMemo(
    () => [collections[currentCollectionIndex || 0]],
    [currentCollectionIndex]
  )

  const { walletNFTs, fetchNFTs } = useWalletNFTs(currentCollection)

  const {
    initializeAndTerminateBreeding,
    breedingMachineAccount,
    feedbackStatus,
    userTokenBalance,
  } = useBreeding(currentCollection[0])

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
        <title>Propagate your Nifty Nanas</title>
        <meta
          name="description"
          content="Get a brand new Baby Nana from two Nifty Nanas!"
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
              Propagate your Nanas
            </Heading>
            <Text>Get a brand new Baby Nana from two Nifty Nanas!</Text>
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
            <Heading variant="heading2">
              Select two Nifty Nanas to propagate:
            </Heading>

            <form
              onSubmit={async (e) => {
                e.preventDefault()

                const data = new FormData(e.currentTarget)

                const mints = data.getAll("mint").filter((val) => val)

                if (!anchorWallet?.publicKey) return true

                if (mints.length !== 2) return true

                const res = await initializeAndTerminateBreeding(
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
                margin: "1.6rem 0",
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
                <Button
                  title="Can't see your NFT? Click here to change the collection!"
                  sx={{
                    padding: "0 .8rem",
                    border: "1px solid",
                    borderRadius: "25px",
                  }}
                  variant="resetted"
                  onClick={() => {
                    setCurrentCollectionIdex((prev) =>
                      prev + 1 < collections.length ? prev + 1 : 0
                    )
                  }}
                >
                  !
                </Button>{" "}
              </Flex>

              <Alert
                mb={2}
                sx={{
                  fontSize: "1.4rem",
                }}
              >
                Your two Nifty Nanas&nbsp;will&nbsp;be burned to generate the
                new Baby Nana!
              </Alert>

              <Flex
                sx={{
                  flexDirection: "column",
                  alignItems: "center",
                  gap: ".8rem",
                }}
              >
                {cost && anchorWallet?.publicKey ? (
                  <Text
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: ".8rem",
                    }}
                  >
                    {" "}
                    {cost && "Cost: " + cost / 1000} | Your Balance:{" "}
                    {userTokenBalance || "0"}
                    <img
                      sx={{
                        maxWidth: "3.2rem",
                      }}
                      src="/nanascoin.png"
                    />
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
                  propagate!
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
                        variant="small"
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

            {/* <Heading variant="heading2" mt="4.8rem" mb=".8rem">
              Your current breedings
            </Heading>

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
            </Flex> */}

            {/* <Text
              variant="small"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                margin: "1.6rem 0",
              }}
            >
              <Text variant="small">stuck?</Text>
              <Button variant="resetted" onClick={() => onMint()}>
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
          </Text>
        </a>
      </footer>
    </>
  )
}
