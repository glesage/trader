function fixedDecimals(number, decimals)
{
    var multiplier = Math.pow(10, decimals);
    var rounded = (Math.floor(multiplier * parseFloat(number)) / multiplier);
    return rounded.toFixed(decimals);
}

function btfnxPrice(price)
{
    var priceFixed = parseFloat(price);
    if (priceFixed > 1000) return fixedDecimals(priceFixed, 1);
    else if (priceFixed > 100) return fixedDecimals(priceFixed, 2);
    else if (priceFixed > 10) return fixedDecimals(priceFixed, 3);
    else return 0;
}

module.exports.btfnxPrice = btfnxPrice;
module.exports.fixedDecimals = fixedDecimals;
