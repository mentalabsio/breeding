/** @jsxImportSource theme-ui */

import Header from "@/components/Header/Header"
import { PlusSign } from "@/components/icons"
import { LoadingIcon } from "@/components/icons/LoadingIcon"
import NFTSelector from "@/components/NFTSelector/NFTSelector"
import { useBreeding } from "@/hooks/useBreeding/useBreeding"
import { web3 } from "@project-serum/anchor"
import { useAnchorWallet } from "@solana/wallet-adapter-react"
import { Button, Flex, Heading, Text } from "@theme-ui/components"
import Head from "next/head"

export default function Home() {
  const anchorWallet = useAnchorWallet()
  const {
    initializeBreeding,
    terminateBreeding,
    initializeBreedingMachine,
    breedingMachineAccount,
    userBreedDatas,
    feedbackStatus,
    userTokenBalance,
  } = useBreeding()

  console.log(breedingMachineAccount)
  console.log(breedingMachineAccount?.config.initializationFeePrice.toNumber())
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

        <Button onClick={initializeBreedingMachine}>initialize</Button>

        {breedingMachineAccount && (
          <>
            <hr />
            <Text>
              Burn parents:{" "}
              {breedingMachineAccount?.config.burnParents ? "Yes" : "No"}
            </Text>
            <Text>
              Total breeding: {breedingMachineAccount.bred.toNumber()}
            </Text>
            <Text>Total born: {breedingMachineAccount.born.toNumber()}</Text>
          </>
        )}

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

                  // "@media (min-width: 768px)": {
                  //   flexDirection: "row",
                  // },
                }}
              >
                <NFTSelector name="mint" />

                <PlusSign
                  sx={{
                    width: "3.2rem",
                    height: "3.2rem",
                    stroke: "text",
                    strokeWidth: ".2rem",
                  }}
                />

                <NFTSelector name="mint" />
              </Flex>
              <Flex
                sx={{
                  flexDirection: "column",
                  alignItems: "center",
                  gap: ".8rem",
                }}
              >
                <Text>
                  {cost && "Cost: " + cost} | Balance: {userTokenBalance || "0"}
                </Text>
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

            <hr
              sx={{
                marginTop: "1.6rem",
              }}
            />
            <Heading variant="heading2" mt="1.6rem">
              Your breeds
            </Heading>
            {userBreedDatas ? (
              userBreedDatas.length ? (
                <Flex
                  sx={{
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {userBreedDatas.map((breedData) => (
                    <Flex
                      key={breedData.timestamp}
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
                        {breedData.mintA.toString().slice(0, 6) + "..."} +{" "}
                        {breedData.mintB.toString().slice(0, 6) + "..."}
                        <Button
                          variant="secondary"
                          onClick={() =>
                            terminateBreeding(breedData.mintA, breedData.mintB)
                          }
                        >
                          Terminate
                        </Button>
                      </Flex>
                      <Flex>
                        {new Date(
                          breedData.timestamp.toNumber() * 1000
                        ).toLocaleString()}
                      </Flex>
                    </Flex>
                  ))}
                </Flex>
              ) : (
                <Text>Empty.</Text>
              )
            ) : (
              <LoadingIcon />
            )}
          </Flex>
        </Flex>
      </main>

      <footer
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "4rem",
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
          Powered by{" "}
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
              src="/magicshards.png"
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
