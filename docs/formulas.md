# [User Manual](README.md) > Formulas

Next: [Browser](browser.md),
Previous: [Editor](editor.md)

## Table of contents
- [Description](#description)
  - [Primitive value types](#primitive-value-types)
  - [Conversion](#conversion)
- [Built-in functionality](#built-in-functionality)
  - [Identifiers](#identifiers)
  - [Functions](#functions)
  - [Operators](#operators)

## Description
Formulas are a way to algebraically represent [values](editor#value-types). These values then update dynamically if any of the formula dependencies change. In a lot of cases it is easier, more convenient, or otherwise outright impossible to represent a specific value without using a formula.

Formulas consist of any combination and composition of [primitive values](#primitive-value-types), [identifiers](#identifiers), [functions](#functions) and [operators](#operators). When evaluated they can either produce a primitive value.

An error will be shown in cases where the formula was malformed, the recipient property expected a result with a [different primitive type](#conversion), an unknown unit or identifier was referenced, or the wrong type or number of arguments or operands were passed to a function or operator.

### Primitive value types
The following value types are recognised in formulas. They are related to [editor types](editor.md#value-types).

#### number
Equivalent to the `number` type. Additionally, numbers can also use the "e notation".

*Example:*
```
1.2e-3
Result: 0.0012
```

#### string
Similar to the `text` type, but unlike it, strings are surrounded by double quotes (`"`). To use double quotes or backslashes inside strings, they need to be escaped with a backslash.

*Example:*
```
"This is a double quote - \", and this - \\, is a backslash "
Result This is a double quote - ", and this - \, is a backslash
```

#### boolean
Similar to the `boolean` type, but the only allowed values are the `true` and `false` [identifiers](#identifiers).

#### quantity
A number followed by a [unit](editor.md#units), which represents either a `distance` or an `angle` type.

*Example:*
```
1.2cm
Result: 12mm
```

### Conversion
Properties which expect a quantity, but the formula evaluates to a number, will automatically convert that number to a quantity in their base unit without throwing an error.

Additionally the result of some functions or operators might produce a primitive value of a different type than their arguments or operands - e.g multiplying a number by a quantity will produce a quantity, dividing a quantity by the same quantity type will produce a number, calling the [len() function](#len) on a string will produce a number, etc.

## Built-in functionality

### Identifiers
Identifiers are named references to primitive values. They are similar to the `text` type, with the restriction that they must start with a letter and can only contain letters, numbers and underscores.

The following built-in identifiers are available:

#### true
A [boolean](#boolean) `true` value

#### false
A [boolean](#boolean) `false` value

#### PI
A [number](#number) that represents the constant Pi (3.1315...)

#### TAU
A [number](#number) that represents the constant Tau, equal 2*Pi (6.2831...)

#### E
A [number](#number) that represents the Euler's number (2.7182...)

### Functions
Functions can process one or more inputs, called arguments, and produce a primitive value. They consist of an identifier followed by an opening and closing parenthesis, within which is a comma separated list of arguments. These arguments can be anything - numbers, booleans, quantities, operator expressions, or even other function invocations.

#### abs
*Usage:*
```
abs(number) -> number
abs(quantity) -> quantity
```

Returns the absolute value of the input argument.

*Example:*
```
abs(-10)
Result: 10
```

#### ceil
*Usage:*
```
ceil(number) -> number
ceil(quantity) -> quantity
```

Returns the value of the input argument rounded up.

*Example:*
```
ceil(0.5mm)
Result: 1mm
```

#### floor
*Usage:*
```
floor(number) -> number
floor(quantity) -> quantity
```

Returns the value of the input argument rounded down.

*Example:*
```
floor(0.5)
Result: 0
```

#### round
*Usage:*
```
round(number) -> number
round(quantity) -> quantity
```

Returns the value of the input argument rounded to the nearest number.

*Example:*
```
round(0.6)
Result: 1
```

#### fract
*Usage:*
```
fract(number) -> number
fract(quantity) -> quantity
```

Returns the fractional part of the input argument.

*Example:*
```
fract(1.2mm)
Result: 0.2mm
```

#### trunc
*Usage:*
```
trunc(number) -> number
trunc(quantity) -> quantity
```

Returns the whole number part of the input argument.

*Example:*
```
trunc(1.2mm)
Result: 1mm
```

#### min
*Usage:*
```
min(number, number) -> number
min(quantity, quantity) -> quantity
```

Returns the smallest of the two arguments.

*Example:*
```
min(2mm, 5mm)
Result: 2mm
```

#### max
*Usage:*
```
max(number, number) -> number
max(quantity, quantity) -> quantity
```

Returns the largest of the two arguments.

*Example:*
```
max(2, 5)
Result: 5
```

#### pow
*Usage:*
```
pow(number, number) -> number
pow(quantity, number) -> quantity
```

Returns the value of the first argument to the power of the second argument.

*Example:*
```
pow(2, 3)
Result: 8
```

#### sqrt
*Usage:*
```
sqrt(number) -> number
sqrt(quantity) -> quantity
```

Returns the square root of the input argument's value.

*Example:*
```
sqrt(16mm)
Result: 4mm
```

#### sign
*Usage:*
```
sign(number) -> number
sign(quantity) -> quantity
```

Returns -1 or 1 depending on whether the input argument is negative or positive.

*Example:*
```
sign(-3.2mm)
Result: -1mm
```

#### log
*Usage:*
```
log(number) -> number
log(quantity) -> quantity
```

Returns the natural logarithm of the input argument's value.

*Example:*
```
log(2)
Result: 0.6931471805599453
```

#### log2
*Usage:*
```
log2(number) -> number
log2(quantity) -> quantity
```

Returns the base-2 logarithm of the input argument's value.

*Example:*
```
log2(2)
Result: 1
```

#### log10
*Usage:*
```
log10(number) -> number
log10(quantity) -> quantity
```

Returns the base-10 logarithm of the input argument's value.

*Example:*
```
log10(2)
Result: 0.3010299956639812
```

#### sin
*Usage:*
```
sin(number) -> number
sin(angle) -> number
```

Returns the sine of the input angle. If a number is provided, its value will be assumed to be in radians.

*Example:*
```
sin(PI)
Result: 0
```

#### cos
*Usage:*
```
cos(number) -> number
cos(angle) -> number
```

Returns the cosine of the input angle. If a number is provided, its value will be assumed to be in radians.

*Example:*
```
cos(PI)
Result: -1
```

#### tan
*Usage:*
```
tan(number) -> number
tan(angle) -> number
```

Returns the tangent of the input angle. If a number is provided, its value will be assumed to be in radians.

*Example:*
```
tan(PI)
Result: 0
```

#### asin
*Usage:*
```
asin(number) -> angle
```

Returns the arcsine of the input argument's value.

*Example:*
```
asin(1)
Result: 90deg
```

#### acos
*Usage:*
```
acos(number) -> angle
```

Returns the arccosine of the input argument's value.

*Example:*
```
acos(1)
Result: 0deg
```

#### atan
*Usage:*
```
atan(number) -> angle
```

Returns the arctangent of the input argument's value.

*Example:*
```
atan(0)
Result: 0deg
```

#### atan2
*Usage:*
```
atan2(number, number) -> angle
```

Returns the angle of the ray from the origin to the supplied xy-coordinates as input arguments relative to the positive x-axis.

*Example:*
```
atan2(1, 1)
Result: 45deg
```

#### sinh
*Usage:*
```
sinh(number) -> number
```

Returns the hyperbolic sine of the input argument's value.

*Example:*
```
sinh(0)
Result: 0
```

#### cosh
*Usage:*
```
cosh(number) -> number
```

Returns the hyperbolic cosine of the input argument's value.

*Example:*
```
cosh(0)
Result: 1
```

#### tanh
*Usage:*
```
tanh(number) -> number
```

Returns the hyperbolic tangent of the input argument's value.

*Example:*
```
tanh(0)
Result: 0
```

#### asinh
*Usage:*
```
asinh(number) -> number
```

Returns the inverse hyperbolic sine of the input argument's value.

*Example:*
```
asinh(0)
Result: 0
```

#### acosh
*Usage:*
```
acosh(number) -> number
```

Returns the inverse hyperbolic cosine of the input argument's value.

*Example:*
```
acosh(1)
Result: 0
```

#### atanh
*Usage:*
```
atanh(number) -> number
```

Returns the inverse hyperbolic tangent of the input argument's value.

*Example:*
```
atanh(0)
Result: 0
```

#### substr
*Usage:*
```
substr(string, number, number) -> string
```

Returns a substring of the string in the first argument, that starts and ends at the zero-based character indices, denoted by the second and third argument values.

*Example:*
```
substr("foobar", 2, 5)
Result: "oba"
```

#### concat
*Usage:*
```
concat(string, string) -> string
```

Returns a string that is a combination of the strings in the two input arguments.

*Example:*
```
concat("foo", "bar")
Result: "foobar"
```

#### find
*Usage:*
```
find(string, string) -> number
```

Returns the zero-based position of the second string argument inside the first string argument, or -1 if no match was found.


*Example:*
```
find("foobar", "bar")
Result: 3
```

#### regexfind
*Usage:*
```
regexfind(string, string) -> number
```

Returns the zero-based position of the second regex-formatted string argument inside the first string argument, or -1 if no match was found.

*Example:*
```
regexfind("FOOBAR", "/[o]+b/i")
Result: 1
```

#### regexmatch
*Usage:*
```
regexmatch(string, string) -> string
```

Returns the substring matching the second regex-formatted string argument inside the first string argument.

*Example:*
```
regexmatch("foobar", "[o]+b")
Result: "oob"
```

#### replace
*Usage:*
```
replace(string, string, string) -> string
```

Returns the first string argument with the first occurance of the second string argument replaced with the third string argument.

*Example:*
```
replace("foobar", "o", "0")
Result: "f0obar"
```

#### replaceall
*Usage:*
```
replaceall(string, string, string) -> string
```

Returns the first string argument with all occurances of the second string argument replaced with the third string argument.

*Example:*
```
replaceall("foobar", "o", "0")
Result: "f00bar"
```

#### regexreplace
*Usage:*
```
regexreplace(string, string, string) -> string
```

Returns the first string argument with occurrences matching the second regex-formatted string argument replaced with the third string argument.

*Example:*
```
regexreplace("foobar", "([oa]).", "($1)")
Result: "f(o)b(a)"
```

#### len
*Usage:*
```
len(string) -> number
```

Returns the length of the input argument string.

*Example:*
```
len("foobar")
Result: 6
```

#### padstart
*Usage:*
```
padstart(string, number, string) -> string
```

Returns the first input argument string, padded at the start to be at least the second input argument's value long, using the third input string argument as a padding string.

*Example:*
```
padstart("foo", 6, "xy")
Result: "xyxfoo"
```

#### padend
*Usage:*
```
padend(string, number, string) -> string
```

Returns the first input argument string, padded at the end to be at least the second input argument's value long, using the third input string argument as a padding string.

*Example:*
```
padend("foo", 6, "xy")
Result: "fooxyx"
```

#### repeat
*Usage:*
```
repeat(string, number) -> string
```

Returns the string in the first input argument, repeated as many times as directed by the second input argument's value.

*Example:*
```
repeat("foo", 3)
Result: "foofoofoo"
```

#### uppercase
*Usage:*
```
uppercase(string) -> string
```

Returns the input string argument with all its characters converted to upper-case.

*Example:*
```
uppercase("FooBar")
Result: "FOOBAR"
```

#### lowercase
*Usage:*
```
lowercase(string) -> string
```

Returns the input string argument with all its characters converted to lower-case.

*Example:*
```
lowercase("FooBar")
Result: "foobar"
```

### Operators
Operators are similar to functions in that they take multiple inputs, called operands, and produce a primitive value. Operators are denoted by symbols and can be unary (`op value`), binary (`value op value`), or ternary (`value op value op value`).

Unlike functions arguments, operator operands cannot be operator expressions themselves, unless these sub-expressions are grouped with parenthesis - e.g `(1 + 1) * 2`.

In case there are multiple operator expressions following each other without using grouping, these expressions will be implicitly grouped and evaluated in the same order of precedence as the following list.

#### unary +
*Usage:*
```
+number -> number
+quantity -> quantity
```

Returns the operand unchanged.

*Example:*
```
+1
Result: 1
```

#### unary -
*Usage:*
```
-number -> number
-quantity -> quantity
```

Returns the operand value negated.

*Example:*
```
-1mm
Result: -1mm
```

#### unary !
*Usage:*
```
!boolean -> boolean
```

Returns the boolean operand negated.

*Example:*
```
!true
Result: false
```

#### ^
*Usage:*
```
number ^ number -> number
quantity ^ number -> quantity
```

returns the first operand to the power of the value of the second operand.

*Example:*
```
2mm ^ 2
Result: 4mm
```

#### *
*Usage:*
```
number * number -> number
number * quantity -> quantity
quantity * number -> quantity
```

Returns the product of the two operands.

*Example:*
```
1mm * 2
Result: 2mm
```

#### /
*Usage:*
```
number / number -> number
quantity / quantity -> number
quantity / number -> quantity
```

Returns the left operand divided by the second operand's value.

*Example:*
```
2mm / 4mm
Result: 0.5
```

#### %
*Usage:*
```
number % number -> number
quantity % number -> quantity
```

Returns the remainder of the division between the two operands.

*Example:*
```
10mm % 3
Result: 1mm
```

#### +
*Usage:*
```
number + number -> number
quantity + quantity -> quantity
```

Returns the sum of the two operands.

*Example:*
```
1 + 2
Result: 3
```

#### -
*Usage:*
```
number - number -> number
quantity - quantity -> quantity
```

Returns the difference between the two operands.

*Example:*
```
3mm - 2mm
Result: 1mm
```

#### <<
*Usage:*
```
number << number -> number
quantity << number -> quantity
```

Returns the left operand's value shifted left by the number of bits represented in the right operand's value.

*Example:*
```
4 << 1
Result: 8
```

#### >>
*Usage:*
```
number >> number -> number
quantity >> number -> quantity
```

Returns the left operand's value shifted right by the number of bits represented in the right operand's value.

*Example:*
```
5mm >> 1
Result: 2mm
```

#### <
*Usage:*
```
number < number -> boolean
quantity < quantity -> boolean
```

Returns a boolean, representing whether the left operand is smaller than the right operand.

*Example:*
```
1 < 2
Result: true
```

#### <=
*Usage:*
```
number <= number -> boolean
quantity <= quantity -> boolean
```

Returns a boolean, representing whether the left operand is smaller than or equal to the right operand.

*Example:*
```
1mm <= 1mm
Result: true
```

#### >
*Usage:*
```
number > number -> boolean
quantity > quantity -> boolean
```

Returns a boolean, representing whether the left operand is larger than the right operand.

*Example:*
```
1 > 2
Result: false
```

#### >=
*Usage:*
```
number >= number -> boolean
quantity >= quantity -> boolean
```

Returns a boolean, representing whether the left operand is larger than or equal to the right operand.

*Example:*
```
2 >= 1
Result: true
```

#### ==
*Usage:*
```
any == any -> boolean
```

Returns a boolean, representing whether both operands have the same type, value, and if applicable - quantity type.


*Example:*
```
1 == 2
Result: false
```

#### !=
*Usage:*
```
any != any -> boolean
```


*Example:*
```
1mm != 1deg
Result: true
```

#### &
*Usage:*
```
number & number -> number
quantity & number -> quantity
```

Returns the bitwise AND of both operands.

*Example:*
```
3 & 1
Result: 1
```

#### |
*Usage:*
```
number | number -> number
quantity | number -> quantity
```

Returns the bitwise OR of both operands.

*Example:*
```
2mm | 1
Result: 3mm
```

#### &&
*Usage:*
```
boolean && boolean -> boolean
```

Returns a boolean that represents whether both operands are true.

*Example:*
```
true && false
Result: false
```

#### ||
*Usage:*
```
boolean || boolean -> boolean
```

Returns a boolean that represents whether either operand is true.

*Example:*
```
true || false
Result: true
```

#### ternary ?
*Usage:*
```
boolean ? any : any -> any
```

If the first operand is true, return the second operand, otherwise return the third operand.


*Example:*
```
false ? 1mm : 2mm
Result: 2mm
```
