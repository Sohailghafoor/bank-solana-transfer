const fs = require("fs");
const {
  PublicKey,
  Transaction,
  Keypair,
  clusterApiUrl,
  Connection,
  TransactionInstruction,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  getAccount,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
} = require("@solana/spl-token");
const { exit } = require("process");
const AA_TOKEN_ADDRESS = new PublicKey(
  "RQHZhtQSi4r2yAC8eHsWAYanCEqBpv3k6ZmSE9QTkWW"
);

const prepareTransaction = async ({ walletAddress, mintAddress }) => {
  const walletSecretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
  );
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
  const userWalletAddress = new PublicKey(walletAddress);
  const authorityWallet = Keypair.fromSecretKey(walletSecretKey);

  // Get block hash
  const blockhashObj = await connection.getLatestBlockhash();
  const blockhash = blockhashObj.blockhash;

  // create transaction
  const transaction = new Transaction();
  transaction.feePayer = userWalletAddress;
  transaction.recentBlockhash = blockhash;

  // 1. Memo for claim
  transaction.add(
    new TransactionInstruction({
      keys: [{ pubkey: userWalletAddress, isSigner: true, isWritable: true }],
      data: Buffer.from(`aa_token:${mintAddress}`, "utf-8"),
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    })
  );

  // 2. send AA Token from wallet to user
  // 2.1 get accounts
  const userAATokenAccount = await getAssociatedTokenAddress(
    AA_TOKEN_ADDRESS,
    userWalletAddress
  );
  const c3AATokenAccount = await getAssociatedTokenAddress(
    AA_TOKEN_ADDRESS,
    authorityWallet.publicKey
  );

  // 2.2 verify get account or create it
  try {
    await getAccount(connection, userAATokenAccount);
  } catch (error) {
    // means the user doesn't have the account
    transaction.add(
      createAssociatedTokenAccountInstruction(
        userWalletAddress,
        userAATokenAccount,
        userWalletAddress,
        AA_TOKEN_ADDRESS
      )
    );
  }

  // 2.3 add transfer transaction
  transaction.add(
    createTransferCheckedInstruction(
      c3AATokenAccount, // source
      AA_TOKEN_ADDRESS, // mint
      userAATokenAccount, // destination
      authorityWallet.publicKey, // owner of source account
      parseInt(1 * 10 ** 2),
      2
    )
  );

  // sign transaction
  transaction.sign(authorityWallet);

  // serialize and return
  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false,
  });
  return serializedTransaction.toString("base64");
};

prepareTransaction({
  walletAddress: process.argv[3],
  mintAddress: process.argv[4],
})
  .then((transactionHash) => console.log(transactionHash))
  .catch((error) => console.log(error))
  .finally(() => exit());
