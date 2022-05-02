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
  const { walletNFTs } = useWalletNFTs([
    "9bBjPXwFVzPSEA4BH2wFfDnzYTekQq6itf6JBNvzRW2C",
  ])
  const {
    initializeBreeding,
    terminateBreeding,
    breedingMachineAccount,
    userBreedDatas,
    feedbackStatus,
    userTokenBalance,
  } = useBreeding()

  /** Just log some info */
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
        <title>Breeding UI</title>
        <meta name="description" content="Breeding UI created by MagicShards" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />
      <main
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "4rem",
        }}
      >
        <Heading mb=".8rem" variant="heading1">
          Breed
        </Heading>
        <Text>Generate a new NFT from two!</Text>

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
          sx={{
            alignItems: "center",
            gap: ".8rem",
            margin: "1.6rem 0",
          }}
        >
          {feedbackStatus && (
            <>
              {feedbackStatus !== "Success!" && <LoadingIcon />}

              <Text
                sx={{
                  color: feedbackStatus === "Success!" ? "success" : "text",
                }}
              >
                {feedbackStatus}
              </Text>
            </>
          )}{" "}
          &nbsp;
        </Flex>

        <Flex
          my="3.2rem"
          sx={{
            flexDirection: "column",
            gap: "1.6rem",
          }}
        >
          <Flex
            sx={{
              flexDirection: "column",
              gap: ".8rem",
              alignItems: "center",
            }}
          >
            <Heading variant="heading3">Select two NFTs:</Heading>

            <form
              onSubmit={async (e) => {
                e.preventDefault()

                const data = new FormData(e.currentTarget)
                const mints = data.getAll("mint").filter((val) => val)

                if (!anchorWallet?.publicKey) throw new Error("No public key.")

                if (mints.length !== 2) return true

                const res = await initializeBreeding(
                  new web3.PublicKey(mints[0]),
                  new web3.PublicKey(mints[1])
                )

                console.log(res)
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
              </Flex>
            </form>

            <Heading variant="heading1" mt="4.8rem" mb=".8rem">
              Your breedings
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
            {userBreedDatas ? (
              userBreedDatas.length ? (
                <Flex
                  sx={{
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {userBreedDatas.map((breedData) => {
                    return (
                      <Flex
                        key={breedData.breedData.timestamp}
                        sx={{
                          flexDirection: "column",
                          margin: "1.6rem 0",
                          alignItems: "center",
                          justifyContent: "center",
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
                                maxHeight: "3.2rem",
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
                                maxHeight: "3.2rem",
                              }}
                            />
                            {breedData.metadatas[1].externalMetadata.name}
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
                            }}
                          >
                            Terminate
                          </Button>
                        </Flex>
                        {/* <Flex>
                          {new Date(
                            breedData.breedData.timestamp.toNumber() * 1000
                          ).toLocaleString()}
                        </Flex> */}
                      </Flex>
                    )
                  })}
                </Flex>
              ) : (
                <Text>Empty.</Text>
              )
            ) : anchorWallet?.publicKey ? (
              <LoadingIcon />
            ) : (
              "Connect your wallet first."
            )}
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
