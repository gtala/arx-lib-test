
import { fromB64 } from '@mysten/bcs'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'

const PBT_PACKAGE_ID = '0x93d0628b3b4a9b5b9ebde175e8c51fa7b6296e5f9aaf5d9645eca3b17a29a111'
export const mySuiClient = new SuiClient({ url: getFullnodeUrl('testnet') })


export const getUserData = ()=> {
    let userPrivateKeyArray = new Array<number>()
    userPrivateKeyArray = Array.from(fromB64('AHvhK7acqcgXdkSR+gE5jzTFXjvWvH7hdYOesk/MR+07'))
    userPrivateKeyArray.shift() // remove the first byte
    const userKeypair = Ed25519Keypair.fromSecretKey(Uint8Array.from(userPrivateKeyArray))
    const address = userKeypair.getPublicKey().toSuiAddress()

    return {
        userKeypair,
        address
    }
}

export const VerifySignature = async (signature_final:  Uint8Array, pkey_final:  Uint8Array)=> {
    const {
        userKeypair,
    }  = getUserData()

    const tx = new Transaction()
    tx.setGasBudget(2000000)

    tx.moveCall({
        target: `${PBT_PACKAGE_ID}::signature::verify_signature_v3`,
        arguments: [
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            tx.pure(Array.from(signature_final)),
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            tx.pure(Array.from(pkey_final)),
        ],
    })
    const response = await mySuiClient.signAndExecuteTransaction({
        signer: userKeypair,
        transaction: tx,
        requestType: 'WaitForLocalExecution',
        options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
        },
    })

    console.log(response)
}