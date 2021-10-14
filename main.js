const serverUrl = "https://eqgdyc1j3oh6.grandmoralis.com:2053/server"; //Server url from moralis.io
const appId = "sErRijq7UexcHpSyKPY2FdnkNgebSJfVGT73ips6"; // Application id from moralis.io

let currentTrade = {};
let currentSelectSide;
let tokens;
let catgirl_token;
let catgirl_address = "0x79ebc9a2ce02277a4b5b3a768b1c0a4ed75bd936";
let bnb_address = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

async function init() {
    // Manually define catgirl token, since it's not a default 1Inch token
    catgirl_token = {
        "0x79ebc9a2ce02277a4b5b3a768b1c0a4ed75bd936":
        {
            "symbol": "CATGIRL",
            "name": "CatGirl",
            "decimals": 9,
            "address": "0x79ebc9a2ce02277a4b5b3a768b1c0a4ed75bd936",
            "logoURI": "https://bscscan.com/token/images/catgirl_32.png"
        }
    }

    await Moralis.start({ serverUrl, appId });
    await Moralis.enableWeb3();
    await listAvailableTokens(); // all tokens from 1Inch

    refreshLoginButtons();

    // Initialize default tokens
    currentSelectSide = "from";
    selectToken(catgirl_address);

    currentSelectSide = "to";
    selectToken(bnb_address);
}

async function login() {
    let user = Moralis.User.current();

    if (user) {
        Moralis.User.logOut();
    }

    try {
        user = await Moralis.authenticate();
        refreshLoginButtons();
    } catch (error) {
        console.log(error);
        Moralis.User.logOut();
    }
}

async function logOut() {
    await Moralis.User.logOut();
    refreshLoginButtons();
    console.log("logged out. User:", Moralis.User.current());
}

function refreshLoginButtons() {
    let user = Moralis.User.current();
    let boolLoggedOn = user == null ? true : false;

    document.getElementById("login_button").disabled = !boolLoggedOn;
    document.getElementById("logout_button").disabled = boolLoggedOn;
    document.getElementById("swap_button").disabled = boolLoggedOn;
}

async function listAvailableTokens() {
    const result = await Moralis.Plugins.oneInch.getSupportedTokens({
        chain: 'bsc' // The blockchain you want to use (eth/bsc/polygon)
    });

    tokens = Object.assign({}, catgirl_token, result.tokens); // Want catgirl token in front

    let parent = document.getElementById("token_list");
    for (const address in tokens) {
        let token = tokens[address];
        let div = document.createElement("div");
        div.setAttribute("data-address", address)
        div.className = "token_row";
        let html = `
        <img class="token_list_img" src="${token.logoURI}">
        <span class="token_list_text">${token.symbol}</span>
        `
        div.innerHTML = html;
        div.onclick = (() => { selectToken(address) });
        parent.appendChild(div);
    }
}

function selectToken(address) {
    closeModal();
    console.log(tokens);
    currentTrade[currentSelectSide] = tokens[address];
    console.log(currentTrade);
    renderInterface();
    getQuote();
}

function exchangeAlt() {
    let fromAddress = currentTrade.to.address;
    let toAddress = currentTrade.from.address;

    currentSelectSide = "from";
    selectToken(fromAddress);

    currentSelectSide = "to";
    selectToken(toAddress);

    document.getElementById("from_amount").value = "";
    document.getElementById("to_amount").value = "";
}

function renderInterface() {
    if (currentTrade.from) {
        document.getElementById("from_token_img").src = currentTrade.from.logoURI;
        document.getElementById("from_token_text").innerHTML = currentTrade.from.symbol;
    }
    if (currentTrade.to) {
        document.getElementById("to_token_img").src = currentTrade.to.logoURI;
        document.getElementById("to_token_text").innerHTML = currentTrade.to.symbol;
    }
}

function openModal(side) {
    currentSelectSide = side;
    document.getElementById("token_modal").style.display = "block";
}
function closeModal() {
    document.getElementById("token_modal").style.display = "none";
}

async function getQuote() {
    if (!currentTrade.from || !currentTrade.to || !document.getElementById("from_amount").value) return;

    let amount = Number(
        document.getElementById("from_amount").value * 10 ** currentTrade.from.decimals
    );

    const quote = await Moralis.Plugins.oneInch.quote({
        chain: 'bsc', // The blockchain you want to use (eth/bsc/polygon)
        fromTokenAddress: currentTrade.from.address, // The token you want to swap
        toTokenAddress: currentTrade.to.address, // The token you want to receive
        amount: amount,
    });
    console.log(quote);
    document.getElementById("gas_estimate").innerHTML = quote.estimatedGas;
    document.getElementById("to_amount").value = quote.toTokenAmount / (10 ** quote.toToken.decimals);
}

async function trySwap() {
    let address = Moralis.User.current().get("ethAddress");
    if (typeof address == 'undefined') {
        alert("Please login");
        return;
    }
    let amount = Number(
        document.getElementById("from_amount").value * 10 ** currentTrade.from.decimals
    )
    if (currentTrade.from.symbol !== "BNB") {
        console.log(currentTrade.from.address);
        console.log(address);
        console.log(amount);
        const allowance = await Moralis.Plugins.oneInch.hasAllowance({
            chain: 'bsc', // The blockchain you want to use (eth/bsc/polygon)
            fromTokenAddress: currentTrade.from.address, // The token you want to swap
            fromAddress: address, // Your wallet address
            amount: amount,
        });
        console.log(allowance);
        if (!allowance) {
            await Moralis.Plugins.oneInch.approve({
                chain: 'bsc', // The blockchain you want to use (eth/bsc/polygon)
                tokenAddress: currentTrade.from.address, // The token you want to swap
                fromAddress: address, // Your wallet address
            });
        }
    }
    try {
        let receipt = await doSwap(address, amount);
        alert("Swap Complete");

    } catch (error) {
        console.log(error);
    }
}

function doSwap(userAddress, amount) {
    return Moralis.Plugins.oneInch.swap({
        chain: 'bsc', // The blockchain you want to use (eth/bsc/polygon)
        fromTokenAddress: currentTrade.from.address, // The token you want to swap
        toTokenAddress: currentTrade.to.address, // The token you want to receive
        amount: amount,
        fromAddress: userAddress, // Your wallet address
        slippage: 1,
    });
}

init();

document.getElementById("modal_close").onclick = closeModal;
document.getElementById("from_token_select").onclick = (() => { openModal("from") });
document.getElementById("to_token_select").onclick = (() => { openModal("to") });
document.getElementById("login_button").onclick = login;
document.getElementById("logout_button").onclick = logOut;
document.getElementById("from_amount").onblur = getQuote;
document.getElementById("swap_button").onclick = trySwap;
document.getElementById("exchange_alt_button").onclick = exchangeAlt;