; (function () {

    // BigInt, a suite of routines for performing multiple-precision arithmetic in
    // JavaScript.
    //
    // Copyright 1998-2005 David Shapiro.
    //
    // You may use, re-use, abuse,
    // copy, and modify this code to your liking, but please keep this header.
    // Thanks!
    //
    // Dave Shapiro
    // dave@ohdave.com

    // IMPORTANT THING: Be sure to set maxDigits according to your precision
    // needs. Use the setMaxDigits() function to do this. See comments below.
    //
    // Tweaked by Ian Bunning
    // Alterations:
    // Fix bug in function biFromHex(s) to allow
    // parsing of strings of length != 0 (mod 4)

    // Changes made by Dave Shapiro as of 12/30/2004:
    //
    // The BigInt() constructor doesn't take a string anymore. If you want to
    // create a BigInt from a string, use biFromDecimal() for base-10
    // representations, biFromHex() for base-16 representations, or
    // biFromString() for base-2-to-36 representations.
    //
    // biFromArray() has been removed. Use biCopy() instead, passing a BigInt
    // instead of an array.
    //
    // The BigInt() constructor now only constructs a zeroed-out array.
    // Alternatively, if you pass <true>, it won't construct any array. See the
    // biCopy() method for an example of this.
    //
    // Be sure to set maxDigits depending on your precision needs. The default
    // zeroed-out array ZERO_ARRAY is constructed inside the setMaxDigits()
    // function. So use this function to set the variable. DON'T JUST SET THE
    // VALUE. USE THE FUNCTION.
    //
    // ZERO_ARRAY exists to hopefully speed up construction of BigInts(). By
    // precalculating the zero array, we can just use slice(0) to make copies of
    // it. Presumably this calls faster native code, as opposed to setting the
    // elements one at a time. I have not done any timing tests to verify this
    // claim.

    // Max number = 10^16 - 2 = 9999999999999998;
    //               2^53     = 9007199254740992;

    var biRadixBase = 2;
    var biRadixBits = 16;
    var bitsPerDigit = biRadixBits;
    var biRadix = 1 << 16; // = 2^16 = 65536
    var biHalfRadix = biRadix >>> 1;
    var biRadixSquared = biRadix * biRadix;
    var maxDigitVal = biRadix - 1;
    var maxInteger = 9999999999999998;

    // maxDigits:
    // Change this to accommodate your largest number size. Use setMaxDigits()
    // to change it!
    //
    // In general, if you're working with numbers of size N bits, you'll need 2*N
    // bits of storage. Each digit holds 16 bits. So, a 1024-bit key will need
    //
    // 1024 * 2 / 16 = 128 digits of storage.
    //

    var maxDigits;
    var ZERO_ARRAY;
    var bigZero, bigOne;

    function setMaxDigits(value) {
        maxDigits = value;
        ZERO_ARRAY = new Array(maxDigits);
        for (var iza = 0; iza < ZERO_ARRAY.length; iza++) ZERO_ARRAY[iza] = 0;
        bigZero = new BigInt();
        bigOne = new BigInt();
        bigOne.digits[0] = 1;
    }

    setMaxDigits(20);

    // The maximum number of digits in base 10 you can convert to an
    // integer without JavaScript throwing up on you.
    var dpl10 = 15;
    // lr10 = 10 ^ dpl10
    var lr10 = biFromNumber(1000000000000000);

    function BigInt(flag) {
        if (typeof flag == "boolean" && flag == true) {
            this.digits = null;
        }
        else {
            this.digits = ZERO_ARRAY.slice(0);
        }
        this.isNeg = false;
    }

    function biFromDecimal(s) {
        var isNeg = s.charAt(0) == '-';
        var i = isNeg ? 1 : 0;
        var result;
        // Skip leading zeros.
        while (i < s.length && s.charAt(i) == '0') ++i;
        if (i == s.length) {
            result = new BigInt();
        }
        else {
            var digitCount = s.length - i;
            var fgl = digitCount % dpl10;
            if (fgl == 0) fgl = dpl10;
            result = biFromNumber(Number(s.substr(i, fgl)));
            i += fgl;
            while (i < s.length) {
                result = biAdd(biMultiply(result, lr10),
                    biFromNumber(Number(s.substr(i, dpl10))));
                i += dpl10;
            }
            result.isNeg = isNeg;
        }
        return result;
    }

    function biCopy(bi) {
        var result = new BigInt(true);
        result.digits = bi.digits.slice(0);
        result.isNeg = bi.isNeg;
        return result;
    }

    function biFromNumber(i) {
        var result = new BigInt();
        result.isNeg = i < 0;
        i = Math.abs(i);
        var j = 0;
        while (i > 0) {
            result.digits[j++] = i & maxDigitVal;
            i >>= biRadixBits;
        }
        return result;
    }

    function reverseStr(s) {
        var result = "";
        for (var i = s.length - 1; i > -1; --i) {
            result += s.charAt(i);
        }
        return result;
    }

    var hexatrigesimalToChar = new Array(
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
        'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
        'u', 'v', 'w', 'x', 'y', 'z'
    );

    function biToString(x, radix)
    // 2 <= radix <= 36
    {
        var b = new BigInt();
        b.digits[0] = radix;
        var qr = biDivideModulo(x, b);
        var result = hexatrigesimalToChar[qr[1].digits[0]];
        while (biCompare(qr[0], bigZero) == 1) {
            qr = biDivideModulo(qr[0], b);
            digit = qr[1].digits[0];
            result += hexatrigesimalToChar[qr[1].digits[0]];
        }
        return (x.isNeg ? "-" : "") + reverseStr(result);
    }

    function biToDecimal(x) {
        var b = new BigInt();
        b.digits[0] = 10;
        var qr = biDivideModulo(x, b);
        var result = String(qr[1].digits[0]);
        while (biCompare(qr[0], bigZero) == 1) {
            qr = biDivideModulo(qr[0], b);
            result += String(qr[1].digits[0]);
        }
        return (x.isNeg ? "-" : "") + reverseStr(result);
    }

    var hexToChar = new Array('0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'a', 'b', 'c', 'd', 'e', 'f');

    function digitToHex(n) {
        var mask = 0xf;
        var result = "";
        for (i = 0; i < 4; ++i) {
            result += hexToChar[n & mask];
            n >>>= 4;
        }
        return reverseStr(result);
    }

    function biToHex(x) {
        var result = "";
        var n = biHighIndex(x);
        for (var i = biHighIndex(x); i > -1; --i) {
            result += digitToHex(x.digits[i]);
        }
        return result;
    }

    function charToHex(c) {
        var ZERO = 48;
        var NINE = ZERO + 9;
        var littleA = 97;
        var littleZ = littleA + 25;
        var bigA = 65;
        var bigZ = 65 + 25;
        var result;

        if (c >= ZERO && c <= NINE) {
            result = c - ZERO;
        } else if (c >= bigA && c <= bigZ) {
            result = 10 + c - bigA;
        } else if (c >= littleA && c <= littleZ) {
            result = 10 + c - littleA;
        } else {
            result = 0;
        }
        return result;
    }

    function hexToDigit(s) {
        var result = 0;
        var sl = Math.min(s.length, 4);
        for (var i = 0; i < sl; ++i) {
            result <<= 4;
            result |= charToHex(s.charCodeAt(i))
        }
        return result;
    }

    function biFromHex(s) {
        var result = new BigInt();
        var sl = s.length;
        for (var i = sl, j = 0; i > 0; i -= 4, ++j) {
            result.digits[j] = hexToDigit(s.substr(Math.max(i - 4, 0), Math.min(i, 4)));
        }
        return result;
    }

    function biFromString(s, radix) {
        var isNeg = s.charAt(0) == '-';
        var istop = isNeg ? 1 : 0;
        var result = new BigInt();
        var place = new BigInt();
        place.digits[0] = 1; // radix^0
        for (var i = s.length - 1; i >= istop; i--) {
            var c = s.charCodeAt(i);
            var digit = charToHex(c);
            var biDigit = biMultiplyDigit(place, digit);
            result = biAdd(result, biDigit);
            place = biMultiplyDigit(place, radix);
        }
        result.isNeg = isNeg;
        return result;
    }

    function biToBytes(x)
    // Returns a string containing raw bytes.
    {
        var result = "";
        for (var i = biHighIndex(x); i > -1; --i) {
            result += digitToBytes(x.digits[i]);
        }
        return result;
    }

    function digitToBytes(n)
    // Convert two-byte digit to string containing both bytes.
    {
        var c1 = String.fromCharCode(n & 0xff);
        n >>>= 8;
        var c2 = String.fromCharCode(n & 0xff);
        return c2 + c1;
    }

    function biDump(b) {
        return (b.isNeg ? "-" : "") + b.digits.join(" ");
    }

    function biAdd(x, y) {
        var result;

        if (x.isNeg != y.isNeg) {
            y.isNeg = !y.isNeg;
            result = biSubtract(x, y);
            y.isNeg = !y.isNeg;
        }
        else {
            result = new BigInt();
            var c = 0;
            var n;
            for (var i = 0; i < x.digits.length; ++i) {
                n = x.digits[i] + y.digits[i] + c;
                result.digits[i] = n & 0xffff;
                c = Number(n >= biRadix);
            }
            result.isNeg = x.isNeg;
        }
        return result;
    }

    function biSubtract(x, y) {
        var result;
        if (x.isNeg != y.isNeg) {
            y.isNeg = !y.isNeg;
            result = biAdd(x, y);
            y.isNeg = !y.isNeg;
        } else {
            result = new BigInt();
            var n, c;
            c = 0;
            for (var i = 0; i < x.digits.length; ++i) {
                n = x.digits[i] - y.digits[i] + c;
                result.digits[i] = n & 0xffff;
                // Stupid non-conforming modulus operation.
                if (result.digits[i] < 0) result.digits[i] += biRadix;
                c = 0 - Number(n < 0);
            }
            // Fix up the negative sign, if any.
            if (c == -1) {
                c = 0;
                for (var i = 0; i < x.digits.length; ++i) {
                    n = 0 - result.digits[i] + c;
                    result.digits[i] = n & 0xffff;
                    // Stupid non-conforming modulus operation.
                    if (result.digits[i] < 0) result.digits[i] += biRadix;
                    c = 0 - Number(n < 0);
                }
                // Result is opposite sign of arguments.
                result.isNeg = !x.isNeg;
            } else {
                // Result is same sign.
                result.isNeg = x.isNeg;
            }
        }
        return result;
    }

    function biHighIndex(x) {
        var result = x.digits.length - 1;
        while (result > 0 && x.digits[result] == 0) --result;
        return result;
    }

    function biNumBits(x) {
        var n = biHighIndex(x);
        var d = x.digits[n];
        var m = (n + 1) * bitsPerDigit;
        var result;
        for (result = m; result > m - bitsPerDigit; --result) {
            if ((d & 0x8000) != 0) break;
            d <<= 1;
        }
        return result;
    }

    function biMultiply(x, y) {
        var result = new BigInt();
        var c;
        var n = biHighIndex(x);
        var t = biHighIndex(y);
        var u, uv, k;

        for (var i = 0; i <= t; ++i) {
            c = 0;
            k = i;
            for (j = 0; j <= n; ++j, ++k) {
                uv = result.digits[k] + x.digits[j] * y.digits[i] + c;
                result.digits[k] = uv & maxDigitVal;
                c = uv >>> biRadixBits;
            }
            result.digits[i + n + 1] = c;
        }
        // Someone give me a logical xor, please.
        result.isNeg = x.isNeg != y.isNeg;
        return result;
    }

    function biMultiplyDigit(x, y) {
        var n, c, uv;

        result = new BigInt();
        n = biHighIndex(x);
        c = 0;
        for (var j = 0; j <= n; ++j) {
            uv = result.digits[j] + x.digits[j] * y + c;
            result.digits[j] = uv & maxDigitVal;
            c = uv >>> biRadixBits;
        }
        result.digits[1 + n] = c;
        return result;
    }

    function arrayCopy(src, srcStart, dest, destStart, n) {
        var m = Math.min(srcStart + n, src.length);
        for (var i = srcStart, j = destStart; i < m; ++i, ++j) {
            dest[j] = src[i];
        }
    }

    var highBitMasks = new Array(0x0000, 0x8000, 0xC000, 0xE000, 0xF000, 0xF800,
        0xFC00, 0xFE00, 0xFF00, 0xFF80, 0xFFC0, 0xFFE0,
        0xFFF0, 0xFFF8, 0xFFFC, 0xFFFE, 0xFFFF);

    function biShiftLeft(x, n) {
        var digitCount = Math.floor(n / bitsPerDigit);
        var result = new BigInt();
        arrayCopy(x.digits, 0, result.digits, digitCount,
            result.digits.length - digitCount);
        var bits = n % bitsPerDigit;
        var rightBits = bitsPerDigit - bits;
        for (var i = result.digits.length - 1, i1 = i - 1; i > 0; --i, --i1) {
            result.digits[i] = ((result.digits[i] << bits) & maxDigitVal) |
                ((result.digits[i1] & highBitMasks[bits]) >>>
                    (rightBits));
        }
        result.digits[0] = ((result.digits[i] << bits) & maxDigitVal);
        result.isNeg = x.isNeg;
        return result;
    }

    var lowBitMasks = new Array(0x0000, 0x0001, 0x0003, 0x0007, 0x000F, 0x001F,
        0x003F, 0x007F, 0x00FF, 0x01FF, 0x03FF, 0x07FF,
        0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF);

    function biShiftRight(x, n) {
        var digitCount = Math.floor(n / bitsPerDigit);
        var result = new BigInt();
        arrayCopy(x.digits, digitCount, result.digits, 0,
            x.digits.length - digitCount);
        var bits = n % bitsPerDigit;
        var leftBits = bitsPerDigit - bits;
        for (var i = 0, i1 = i + 1; i < result.digits.length - 1; ++i, ++i1) {
            result.digits[i] = (result.digits[i] >>> bits) |
                ((result.digits[i1] & lowBitMasks[bits]) << leftBits);
        }
        result.digits[result.digits.length - 1] >>>= bits;
        result.isNeg = x.isNeg;
        return result;
    }

    function biMultiplyByRadixPower(x, n) {
        var result = new BigInt();
        arrayCopy(x.digits, 0, result.digits, n, result.digits.length - n);
        return result;
    }

    function biDivideByRadixPower(x, n) {
        var result = new BigInt();
        arrayCopy(x.digits, n, result.digits, 0, result.digits.length - n);
        return result;
    }

    function biModuloByRadixPower(x, n) {
        var result = new BigInt();
        arrayCopy(x.digits, 0, result.digits, 0, n);
        return result;
    }

    function biCompare(x, y) {
        if (x.isNeg != y.isNeg) {
            return 1 - 2 * Number(x.isNeg);
        }
        for (var i = x.digits.length - 1; i >= 0; --i) {
            if (x.digits[i] != y.digits[i]) {
                if (x.isNeg) {
                    return 1 - 2 * Number(x.digits[i] > y.digits[i]);
                } else {
                    return 1 - 2 * Number(x.digits[i] < y.digits[i]);
                }
            }
        }
        return 0;
    }

    function biDivideModulo(x, y) {
        var nb = biNumBits(x);
        var tb = biNumBits(y);
        var origYIsNeg = y.isNeg;
        var q, r;
        if (nb < tb) {
            // |x| < |y|
            if (x.isNeg) {
                q = biCopy(bigOne);
                q.isNeg = !y.isNeg;
                x.isNeg = false;
                y.isNeg = false;
                r = biSubtract(y, x);
                // Restore signs, 'cause they're references.
                x.isNeg = true;
                y.isNeg = origYIsNeg;
            } else {
                q = new BigInt();
                r = biCopy(x);
            }
            return new Array(q, r);
        }

        q = new BigInt();
        r = x;

        // Normalize Y.
        var t = Math.ceil(tb / bitsPerDigit) - 1;
        var lambda = 0;
        while (y.digits[t] < biHalfRadix) {
            y = biShiftLeft(y, 1);
            ++lambda;
            ++tb;
            t = Math.ceil(tb / bitsPerDigit) - 1;
        }
        // Shift r over to keep the quotient constant. We'll shift the
        // remainder back at the end.
        r = biShiftLeft(r, lambda);
        nb += lambda; // Update the bit count for x.
        var n = Math.ceil(nb / bitsPerDigit) - 1;

        var b = biMultiplyByRadixPower(y, n - t);
        while (biCompare(r, b) != -1) {
            ++q.digits[n - t];
            r = biSubtract(r, b);
        }
        for (var i = n; i > t; --i) {
            var ri = (i >= r.digits.length) ? 0 : r.digits[i];
            var ri1 = (i - 1 >= r.digits.length) ? 0 : r.digits[i - 1];
            var ri2 = (i - 2 >= r.digits.length) ? 0 : r.digits[i - 2];
            var yt = (t >= y.digits.length) ? 0 : y.digits[t];
            var yt1 = (t - 1 >= y.digits.length) ? 0 : y.digits[t - 1];
            if (ri == yt) {
                q.digits[i - t - 1] = maxDigitVal;
            } else {
                q.digits[i - t - 1] = Math.floor((ri * biRadix + ri1) / yt);
            }

            var c1 = q.digits[i - t - 1] * ((yt * biRadix) + yt1);
            var c2 = (ri * biRadixSquared) + ((ri1 * biRadix) + ri2);
            while (c1 > c2) {
                --q.digits[i - t - 1];
                c1 = q.digits[i - t - 1] * ((yt * biRadix) | yt1);
                c2 = (ri * biRadix * biRadix) + ((ri1 * biRadix) + ri2);
            }

            b = biMultiplyByRadixPower(y, i - t - 1);
            r = biSubtract(r, biMultiplyDigit(b, q.digits[i - t - 1]));
            if (r.isNeg) {
                r = biAdd(r, b);
                --q.digits[i - t - 1];
            }
        }
        r = biShiftRight(r, lambda);
        // Fiddle with the signs and stuff to make sure that 0 <= r < y.
        q.isNeg = x.isNeg != origYIsNeg;
        if (x.isNeg) {
            if (origYIsNeg) {
                q = biAdd(q, bigOne);
            } else {
                q = biSubtract(q, bigOne);
            }
            y = biShiftRight(y, lambda);
            r = biSubtract(y, r);
        }
        // Check for the unbelievably stupid degenerate case of r == -0.
        if (r.digits[0] == 0 && biHighIndex(r) == 0) r.isNeg = false;

        return new Array(q, r);
    }

    function biDivide(x, y) {
        return biDivideModulo(x, y)[0];
    }

    function biModulo(x, y) {
        return biDivideModulo(x, y)[1];
    }

    function biMultiplyMod(x, y, m) {
        return biModulo(biMultiply(x, y), m);
    }

    function biPow(x, y) {
        var result = bigOne;
        var a = x;
        while (true) {
            if ((y & 1) != 0) result = biMultiply(result, a);
            y >>= 1;
            if (y == 0) break;
            a = biMultiply(a, a);
        }
        return result;
    }

    function biPowMod(x, y, m) {
        var result = bigOne;
        var a = x;
        var k = y;
        while (true) {
            if ((k.digits[0] & 1) != 0) result = biMultiplyMod(result, a, m);
            k = biShiftRight(k, 1);
            if (k.digits[0] == 0 && biHighIndex(k) == 0) break;
            a = biMultiplyMod(a, a, m);
        }
        return result;
    }





    // BarrettMu, a class for performing Barrett modular reduction computations in
    // JavaScript.
    //
    // Requires BigInt.js.
    //
    // Copyright 2004-2005 David Shapiro.
    //
    // You may use, re-use, abuse, copy, and modify this code to your liking, but
    // please keep this header.
    //
    // Thanks!
    //
    // Dave Shapiro
    // dave@ohdave.com

    function BarrettMu(m) {
        this.modulus = biCopy(m);
        this.k = biHighIndex(this.modulus) + 1;
        var b2k = new BigInt();
        b2k.digits[2 * this.k] = 1; // b2k = b^(2k)
        this.mu = biDivide(b2k, this.modulus);
        this.bkplus1 = new BigInt();
        this.bkplus1.digits[this.k + 1] = 1; // bkplus1 = b^(k+1)
        this.modulo = BarrettMu_modulo;
        this.multiplyMod = BarrettMu_multiplyMod;
        this.powMod = BarrettMu_powMod;
    }

    function BarrettMu_modulo(x) {
        var q1 = biDivideByRadixPower(x, this.k - 1);
        var q2 = biMultiply(q1, this.mu);
        var q3 = biDivideByRadixPower(q2, this.k + 1);
        var r1 = biModuloByRadixPower(x, this.k + 1);
        var r2term = biMultiply(q3, this.modulus);
        var r2 = biModuloByRadixPower(r2term, this.k + 1);
        var r = biSubtract(r1, r2);
        if (r.isNeg) {
            r = biAdd(r, this.bkplus1);
        }
        var rgtem = biCompare(r, this.modulus) >= 0;
        while (rgtem) {
            r = biSubtract(r, this.modulus);
            rgtem = biCompare(r, this.modulus) >= 0;
        }
        return r;
    }

    function BarrettMu_multiplyMod(x, y) {
        /*
        x = this.modulo(x);
        y = this.modulo(y);
        */
        var xy = biMultiply(x, y);
        return this.modulo(xy);
    }

    function BarrettMu_powMod(x, y) {
        var result = new BigInt();
        result.digits[0] = 1;
        var a = x;
        var k = y;
        while (true) {
            if ((k.digits[0] & 1) != 0) result = this.multiplyMod(result, a);
            k = biShiftRight(k, 1);
            if (k.digits[0] == 0 && biHighIndex(k) == 0) break;
            a = this.multiplyMod(a, a);
        }
        return result;
    }




    /**
     * RSA
     */


    /*
    * Copyright (c) 2015 Eric Wilde.
    * Copyright 1998-2015 David Shapiro.
    *
    * RSA.js is a suite of routines for performing RSA public-key computations
    * in JavaScript.  The cryptographic functions herein are used for encoding
    * and decoding strings to be sent over unsecure channels.
    *
    * To use these routines, a pair of public/private keys is created through a
    * number of means (OpenSSL tools on Linux/Unix, Dave Shapiro's
    * RSAKeyGenerator program on Windows).  These keys are passed to RSAKeyPair
    * as hexadecimal strings to create an encryption key object.  This key object
    * is then used with encryptedString to encrypt blocks of plaintext using the
    * public key.  The resulting cyphertext blocks can be decrypted with
    * decryptedString.
    *
    * Note that the cryptographic functions herein are complementary to those
    * found in CryptoFuncs.php and CryptoFuncs.pm.  Hence, encrypted messages may
    * be sent between programs written in any of those languages.  The most
    * useful, of course is to send messages encrypted by a Web page using RSA.js
    * to a PHP or Perl script running on a Web servitron.
    *
    * Also, the optional padding flag may be specified on the call to
    * encryptedString, in which case blocks of cyphertext that are compatible
    * with real crypto libraries such as OpenSSL or Microsoft will be created.
    * These blocks of cyphertext can then be sent to Web servitron that uses one
    * of these crypto libraries for decryption.  This allows messages encrypted
    * with longer keys to be decrypted quickly on the Web server as well as
    * making for more secure communications when a padding algorithm such as
    * PKCS1v1.5 is used.
    *
    * These routines require BigInt.js and Barrett.js.
    */

    /*****************************************************************************/

    /*
    * Modifications
    * -------------
    *
    * 2014 Jan 11  E. Wilde       Add optional padding flag to encryptedString
    *                             for compatibility with real crypto libraries
    *                             such as OpenSSL or Microsoft.  Add PKCS1v1.5
    *                             padding.
    *
    * 2015 Jan 5  D. Shapiro      Add optional encoding flag for encryptedString
    *                             and encapsulate padding and encoding constants
    *                             in RSAAPP object.
    *
    * Original Code
    * -------------
    *
    * Copyright 1998-2005 David Shapiro.
    *
    * You may use, re-use, abuse, copy, and modify this code to your liking, but
    * please keep this header.
    *
    * Thanks!
    *
    * Dave Shapiro
    * dave@ohdave.com
    */

    /*****************************************************************************/

    var RSAAPP = {};

    RSAAPP.NoPadding = "NoPadding";
    RSAAPP.PKCS1Padding = "PKCS1Padding";
    RSAAPP.RawEncoding = "RawEncoding";
    RSAAPP.NumericEncoding = "NumericEncoding"

    /*****************************************************************************/

    function RSAKeyPair(encryptionExponent, decryptionExponent, modulus, keylen)
        /*
        * encryptionExponent                    The encryption exponent (i.e. public
        *                                       encryption key) to be used for
        *                                       encrypting messages.  If you aren't
        *                                       doing any encrypting, a dummy
        *                                       exponent such as "10001" can be
        *                                       passed.
        *
        * decryptionExponent                    The decryption exponent (i.e. private
        *                                       decryption key) to be used for
        *                                       decrypting messages.  If you aren't
        *                                       doing any decrypting, a dummy
        *                                       exponent such as "10001" can be
        *                                       passed.
        *
        * modulus                               The modulus to be used both for
        *                                       encrypting and decrypting messages.
        *
        * keylen                                The optional length of the key, in
        *                                       bits.  If omitted, RSAKeyPair will
        *                                       attempt to derive a key length (but,
        *                                       see the notes below).
        *
        * returns                               The "new" object creator returns an
        *                                       instance of a key object that can be
        *                                       used to encrypt/decrypt messages.
        *
        * This routine is invoked as the first step in the encryption or decryption
        * process to take the three numbers (expressed as hexadecimal strings) that
        * are used for RSA asymmetric encryption/decryption and turn them into a key
        * object that can be used for encrypting and decrypting.
        *
        * The key object is created thusly:
        *
        *      RSAKey = new RSAKeyPair("ABC12345", 10001, "987654FE");
        *
        * or:
        *
        *      RSAKey = new RSAKeyPair("ABC12345", 10001, "987654FE", 64);
        *
        * Note that RSAKeyPair will try to derive the length of the key that is being
        * used, from the key itself.  The key length is especially useful when one of
        * the padding options is used and/or when the encrypted messages created by
        * the routine encryptedString are exchanged with a real crypto library such
        * as OpenSSL or Microsoft, as it determines how many padding characters are
        * appended.
        *
        * Usually, RSAKeyPair can determine the key length from the modulus of the
        * key but this doesn't always work properly, depending on the actual value of
        * the modulus.  If you are exchanging messages with a real crypto library,
        * such as OpenSSL or Microsoft, that depends on the fact that the blocks
        * being passed to it are properly padded, you'll want the key length to be
        * set properly.  If that's the case, of if you just want to be sure, you
        * should specify the key length that you used to generated the key, in bits
        * when this routine is invoked.
        */ {
        /*
        * Convert from hexadecimal and save the encryption/decryption exponents and
        * modulus as big integers in the key object.
        */
        this.e = biFromHex(encryptionExponent);
        this.d = biFromHex(decryptionExponent);
        this.m = biFromHex(modulus);
        /*
        * Using big integers, we can represent two bytes per element in the big
        * integer array, so we calculate the chunk size as:
        *
        *      chunkSize = 2 * (number of digits in modulus - 1)
        *
        * Since biHighIndex returns the high index, not the number of digits, the
        * number 1 has already been subtracted from its answer.
        *
        * However, having said all this, "User Knows Best".  If our caller passes us
        * a key length (in bits), we'll treat it as gospel truth.
        */
        if (typeof (keylen) != 'number') { this.chunkSize = 2 * biHighIndex(this.m); }
        else { this.chunkSize = keylen / 8; }

        this.radix = 16;
        /*
        * Precalculate the stuff used for Barrett modular reductions.
        */
        this.barrett = new BarrettMu(this.m);
    }

    /*****************************************************************************/

    function encryptedString(key, s, pad, encoding)
        /*
        * key                                   The previously-built RSA key whose
        *                                       public key component is to be used to
        *                                       encrypt the plaintext string.
        *
        * s                                     The plaintext string that is to be
        *                                       encrypted, using the RSA assymmetric
        *                                       encryption method.
        *
        * pad                                   The optional padding method to use
        *                                       when extending the plaintext to the
        *                                       full chunk size required by the RSA
        *                                       algorithm.  To maintain compatibility
        *                                       with other crypto libraries, the
        *                                       padding method is described by a
        *                                       string.  The default, if not
        *                                       specified is "OHDave".  Here are the
        *                                       choices:
        *
        *                                         OHDave - this is the original
        *                                           padding method employed by Dave
        *                                           Shapiro and Rob Saunders.  If
        *                                           this method is chosen, the
        *                                           plaintext can be of any length.
        *                                           It will be padded to the correct
        *                                           length with zeros and then broken
        *                                           up into chunks of the correct
        *                                           length before being encrypted.
        *                                           The resultant cyphertext blocks
        *                                           will be separated by blanks.
        *
        *                                           Note that the original code by
        *                                           Dave Shapiro reverses the byte
        *                                           order to little-endian, as the
        *                                           plaintext is encrypted.  If
        *                                           either these JavaScript routines
        *                                           or one of the complementary
        *                                           PHP/Perl routines derived from
        *                                           this code is used for decryption,
        *                                           the byte order will be reversed
        *                                           again upon decryption so as to
        *                                           come out correctly.
        *
        *                                           Also note that this padding
        *                                           method is claimed to be less
        *                                           secure than PKCS1Padding.
        *
        *                                         NoPadding - this method truncates
        *                                           the plaintext to the length of
        *                                           the RSA key, if it is longer.  If
        *                                           its length is shorter, it is
        *                                           padded with zeros.  In either
        *                                           case, the plaintext string is
        *                                           reversed to preserve big-endian
        *                                           order before it is encrypted to
        *                                           maintain compatibility with real
        *                                           crypto libraries such as OpenSSL
        *                                           or Microsoft.  When the
        *                                           cyphertext is to be decrypted
        *                                           by a crypto library, the
        *                                           library routine's RSAAPP.NoPadding
        *                                           flag, or its equivalent, should
        *                                           be used.
        *
        *                                           Note that this padding method is
        *                                           claimed to be less secure than
        *                                           PKCS1Padding.
        *
        *                                         PKCS1Padding - the PKCS1v1.5
        *                                           padding method (as described in
        *                                           RFC 2313) is employed to pad the
        *                                           plaintext string.  The plaintext
        *                                           string must be no longer than the
        *                                           length of the RSA key minus 11,
        *                                           since PKCS1v1.5 requires 3 bytes
        *                                           of overhead and specifies a
        *                                           minimum pad of 8 bytes.  The
        *                                           plaintext string is padded with
        *                                           randomly-generated bytes and then
        *                                           its order is reversed to preserve
        *                                           big-endian order before it is
        *                                           encrypted to maintain
        *                                           compatibility with real crypto
        *                                           libraries such as OpenSSL or
        *                                           Microsoft.  When the cyphertext
        *                                           is to be decrypted by a crypto
        *                                           library, the library routine's
        *                                           RSAAPP.PKCS1Padding flag, or its
        *                                           equivalent, should be used.
        *
        * encoding                              The optional encoding scheme to use
        *                                       for the return value. If ommitted,
        *                                       numeric encoding will be used.
        *
        *                                           RawEncoding - The return value
        *                                           is given as its raw value.
        *                                           This is the easiest method when
        *                                           interoperating with server-side
        *                                           OpenSSL, as no additional conversion
        *                                           is required. Use the constant
        *                                           RSAAPP.RawEncoding for this option.
        *
        *                                           NumericEncoding - The return value
        *                                           is given as a number in hexadecimal.
        *                                           Perhaps useful for debugging, but
        *                                           will need to be translated back to
        *                                           its raw equivalent (e.g. using
        *                                           PHP's hex2bin) before using with
        *                                           OpenSSL. Use the constant
        *                                           RSAAPP.NumericEncoding for this option.
        *
        * returns                               The cyphertext block that results
        *                                       from encrypting the plaintext string
        *                                       s with the RSA key.
        *
        * This routine accepts a plaintext string that is to be encrypted with the
        * public key component of the previously-built RSA key using the RSA
        * assymmetric encryption method.  Before it is encrypted, the plaintext
        * string is padded to the same length as the encryption key for proper
        * encryption.
        *
        * Depending on the padding method chosen, an optional header with block type
        * is prepended, the plaintext is padded using zeros or randomly-generated
        * bytes, and then the plaintext is possibly broken up into chunks.
        *
        * Note that, for padding with zeros, this routine was altered by Rob Saunders
        * (rob@robsaunders.net). The new routine pads the string after it has been
        * converted to an array. This fixes an incompatibility with Flash MX's
        * ActionScript.
        *
        * The various padding schemes employed by this routine, and as presented to
        * RSA for encryption, are shown below.  Note that the RSA encryption done
        * herein reverses the byte order as encryption is done:
        *
        *      Plaintext In
        *      ------------
        *
        *      d5 d4 d3 d2 d1 d0
        *
        *      OHDave
        *      ------
        *
        *      d5 d4 d3 d2 d1 d0 00 00 00 /.../ 00 00 00 00 00 00 00 00
        *
        *      NoPadding
        *      ---------
        *
        *      00 00 00 00 00 00 00 00 00 /.../ 00 00 d0 d1 d2 d3 d4 d5
        *
        *      PKCS1Padding
        *      ------------
        *
        *      d0 d1 d2 d3 d4 d5 00 p0 p1 /.../ p2 p3 p4 p5 p6 p7 02 00
        *                            \------------  ------------/
        *                                         \/
        *                             Minimum 8 bytes pad length
        */ {
        var a = new Array();                    // The usual Alice and Bob stuff
        var sl = s.length;                      // Plaintext string length
        var i, j, k;                            // The usual Fortran index stuff
        var padtype;                            // Type of padding to do
        var encodingtype;                       // Type of output encoding
        var rpad;                               // Random pad
        var al;                                 // Array length
        var result = "";                        // Cypthertext result
        var block;                              // Big integer block to encrypt
        var crypt;                              // Big integer result
        var text;                               // Text result
        /*
        * Figure out the padding type.
        */
        if (typeof (pad) == 'string') {
            if (pad == RSAAPP.NoPadding) { padtype = 1; }
            else if (pad == RSAAPP.PKCS1Padding) { padtype = 2; }
            else { padtype = 0; }
        }
        else { padtype = 0; }
        /*
        * Determine encoding type.
        */
        if (typeof (encoding) == 'string' && encoding == RSAAPP.RawEncoding) {
            encodingtype = 1;
        }
        else { encodingtype = 0; }

        /*
        * If we're not using Dave's padding method, we need to truncate long
        * plaintext blocks to the correct length for the padding method used:
        *
        *       NoPadding    - key length
        *       PKCS1Padding - key length - 11
        */
        if (padtype == 1) {
            if (sl > key.chunkSize) { sl = key.chunkSize; }
        }
        else if (padtype == 2) {
            if (sl > (key.chunkSize - 11)) { sl = key.chunkSize - 11; }
        }
        /*
        * Convert the plaintext string to an array of characters so that we can work
        * with individual characters.
        *
        * Note that, if we're talking to a real crypto library at the other end, we
        * reverse the plaintext order to preserve big-endian order.
        */
        i = 0;

        if (padtype == 2) { j = sl - 1; }
        else { j = key.chunkSize - 1; }

        while (i < sl) {
            if (padtype) { a[j] = s.charCodeAt(i); }
            else { a[i] = s.charCodeAt(i); }

            i++; j--;
        }
        /*
        * Now is the time to add the padding.
        *
        * If we're doing PKCS1v1.5 padding, we pick up padding where we left off and
        * pad the remainder of the block.  Otherwise, we pad at the front of the
        * block.  This gives us the correct padding for big-endian blocks.
        *
        * The padding is either a zero byte or a randomly-generated non-zero byte.
        */
        if (padtype == 1) { i = 0; }

        j = key.chunkSize - (sl % key.chunkSize);

        while (j > 0) {
            if (padtype == 2) {
                rpad = Math.floor(Math.random() * 256);

                while (!rpad) { rpad = Math.floor(Math.random() * 256); }

                a[i] = rpad;
            }
            else { a[i] = 0; }

            i++; j--;
        }
        /*
        * For PKCS1v1.5 padding, we need to fill in the block header.
        *
        * According to RFC 2313, a block type, a padding string, and the data shall
        * be formatted into the encryption block:
        *
        *      EncrBlock = 00 || BlockType || PadString || 00 || Data
        *
        * The block type shall be a single octet indicating the structure of the
        * encryption block. For this version of the document it shall have value 00,
        * 01, or 02. For a private-key operation, the block type shall be 00 or 01.
        * For a public-key operation, it shall be 02.
        *
        * The padding string shall consist of enough octets to pad the encryption
        * block to the length of the encryption key.  For block type 00, the octets
        * shall have value 00; for block type 01, they shall have value FF; and for
        * block type 02, they shall be pseudorandomly generated and nonzero.
        *
        * Note that in a previous step, we wrote padding bytes into the first three
        * bytes of the encryption block because it was simpler to do so.  We now
        * overwrite them.
        */
        if (padtype == 2) {
            a[sl] = 0;
            a[key.chunkSize - 2] = 2;
            a[key.chunkSize - 1] = 0;
        }
        /*
        * Carve up the plaintext and encrypt each of the resultant blocks.
        */
        al = a.length;

        for (i = 0; i < al; i += key.chunkSize) {
            /*
            * Get a block.
            */
            block = new BigInt();

            j = 0;

            for (k = i; k < (i + key.chunkSize); ++j) {
                block.digits[j] = a[k++];
                block.digits[j] += a[k++] << 8;
            }
            /*
            * Encrypt it, convert it to text, and append it to the result.
            */
            crypt = key.barrett.powMod(block, key.e);
            if (encodingtype == 1) {
                text = biToBytes(crypt);
            }
            else {
                text = (key.radix == 16) ? biToHex(crypt) : biToString(crypt, key.radix);
            }
            result += text;
        }
        /*
        * Return the result, removing the last space.
        */
        //result = (result.substring(0, result.length - 1));
        return result;
    }

    /*****************************************************************************/

    function decryptedString(key, c)
        /*
        * key                                   The previously-built RSA key whose
        *                                       private key component is to be used
        *                                       to decrypt the cyphertext string.
        *
        * c                                     The cyphertext string that is to be
        *                                       decrypted, using the RSA assymmetric
        *                                       encryption method.
        *
        * returns                               The plaintext block that results from
        *                                       decrypting the cyphertext string c
        *                                       with the RSA key.
        *
        * This routine is the complementary decryption routine that is meant to be
        * used for JavaScript decryption of cyphertext blocks that were encrypted
        * using the OHDave padding method of the encryptedString routine (in this
        * module).  It can also decrypt cyphertext blocks that were encrypted by
        * RSAEncode (in CryptoFuncs.pm or CryptoFuncs.php) so that encrypted
        * messages can be sent of insecure links (e.g. HTTP) to a Web page.
        *
        * It accepts a cyphertext string that is to be decrypted with the public key
        * component of the previously-built RSA key using the RSA assymmetric
        * encryption method.  Multiple cyphertext blocks are broken apart, if they
        * are found in c, and each block is decrypted.  All of the decrypted blocks
        * are concatenated back together to obtain the original plaintext string.
        *
        * This routine assumes that the plaintext was padded to the same length as
        * the encryption key with zeros.  Therefore, it removes any zero bytes that
        * are found at the end of the last decrypted block, before it is appended to
        * the decrypted plaintext string.
        *
        * Note that the encryptedString routine (in this module) works fairly quickly
        * simply by virtue of the fact that the public key most often chosen is quite
        * short (e.g. 0x10001).  This routine does not have that luxury.  The
        * decryption key that it must employ is the full key length.  For long keys,
        * this can result in serious timing delays (e.g. 7-8 seconds to decrypt using
        * 2048 bit keys on a reasonably fast machine, under the Firefox Web browser).
        *
        * If you intend to send encrypted messagess to a JavaScript program running
        * under a Web browser, you might consider using shorter keys to keep the
        * decryption times low.  Alternately, a better scheme is to generate a random
        * key for use by a symmetric encryption algorithm and transmit it to the
        * other end, after encrypting it with encryptedString.  The other end can use
        * a real crypto library (e.g. OpenSSL or Microsoft) to decrypt the key and
        * then use it to encrypt all of the messages (with a symmetric encryption
        * algorithm such as Twofish or AES) bound for the JavaScript program.
        * Symmetric decryption is orders of magnitude faster than asymmetric and
        * should yield low decryption times, even when executed in JavaScript.
        *
        * Also note that only the OHDave padding method (e.g. zeros) is supported by
        * this routine *AND* that this routine expects little-endian cyphertext, as
        * created by the encryptedString routine (in this module) or the RSAEncode
        * routine (in either CryptoFuncs.pm or CryptoFuncs.php).  You can use one of
        * the real crypto libraries to create cyphertext that can be decrypted by
        * this routine, if you reverse the plaintext byte order first and then
        * manually pad it with zero bytes.  The plaintext should then be encrypted
        * with the NoPadding flag or its equivalent in the crypto library of your
        * choice.
        */ {
        var blocks = c.split(" ");              // Multiple blocks of cyphertext
        var b;                                  // The usual Alice and Bob stuff
        var i, j;                               // The usual Fortran index stuff
        var bi;                                 // Cyphertext as a big integer
        var result = "";                        // Plaintext result
        /*
        * Carve up the cyphertext into blocks.
        */
        for (i = 0; i < blocks.length; ++i) {
            /*
            * Depending on the radix being used for the key, convert this cyphertext
            * block into a big integer.
            */
            if (key.radix == 16) { bi = biFromHex(blocks[i]); }
            else { bi = biFromString(blocks[i], key.radix); }
            /*
            * Decrypt the cyphertext.
            */
            b = key.barrett.powMod(bi, key.d);
            /*
            * Convert the decrypted big integer back to the plaintext string.  Since
            * we are using big integers, each element thereof represents two bytes of
            * plaintext.
            */
            for (j = 0; j <= biHighIndex(b); ++j) {
                result += String.fromCharCode(b.digits[j] & 255, b.digits[j] >> 8);
            }
        }
        /*
        * Remove trailing null, if any.
        */
        if (result.charCodeAt(result.length - 1) == 0) {
            result = result.substring(0, result.length - 1);
        }
        /*
        * Return the plaintext.
        */
        return (result);
    }

    var RSA = {
        RSAAPP: RSAAPP,
        setMaxDigits: setMaxDigits,
        RSAKeyPair: RSAKeyPair,
        decryptedString: decryptedString,
        encryptedString: encryptedString
    };

    RSA.setMaxDigits(262)

    if (typeof module !== 'undefined' && typeof exports === 'object') {
        module.exports = RSA;
    } else if (typeof define === 'function' && (define.amd || define.cmd)) {
        define(function () { return RSA; });
    } else {
        this.RSA = RSA;
    }
}).call(this || (typeof window !== 'undefined' ? window : global));
