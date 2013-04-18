/*
 * Oni Apollo 'object/compare' module
 * Functions for coparing objects for equality
 *
 * Part of the Oni Apollo Standard Module Library
 * Version: 'unstable'
 * http://onilabs.com/apollo
 *
 * (c) 2013 Oni Labs, http://onilabs.com
 *
 * Adapted from undescore.js' `eq` function. underscore.js is
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 *
 * This file is licensed under the terms of the MIT License:
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */
/**
   @module  object/compare
   @summary Functions for comparing objects for equality
   @home    sjs:object/compare
*/

// TODO: (tjc) document

__js {

  exports.eq = exports.equals = function(actual, expected) {
    return eq(actual, expected, [], [], false)[0];
  }

  exports.describeEquals = function(actual, expected) {
    var result = eq(actual, expected, [], [], true);
    if (result[0]) result[1] = null; // `eq` difference messages are only meaningful in the negative case
    return result;
  }

  // recursive comparison function for `exports.eq`.
  var toString = Object.prototype.toString;
  var cleanObjectName = function(n) { return n.replace(/^\[object |\]$/g, ''); }
  var eq = function(a, b, aStack, bStack, describe) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return [true, null];
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return [false, describe && ('expected is a ' + cleanObjectName(toString.call(b)) + ', actual is a ' + cleanObjectName(className))];
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return [a == String(b), null];
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return [a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b), null];
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return [+a == +b, null];
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return [(a.source == b.source &&
                 a.global == b.global &&
                 a.multiline == b.multiline &&
                 a.ignoreCase == b.ignoreCase), null];
    }
    if (typeof a != 'object' || typeof b != 'object') {
      return [false, describe && ('expected is a ' + (typeof b) + ', actual is a ' + (typeof a))];
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return [bStack[length] == b, null];
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = [true, null];
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = [size == b.length, describe && ('expected has ' + b.length + ' elements, actual has ' + size)];
      if (result[0]) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          result = eq(a[size], b[size], aStack, bStack, describe);
          if (!result[0]) {
            if (describe) result[1] = new FieldDifference(size, result[1]);
            break;
          }
        }
      }
    } else {
      if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
        return [false, 'prototypes differ'];
      }
      // Deep compare objects.
      for (var key in a) {
        if (a.hasOwnProperty(key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!b.hasOwnProperty(key)) {
            result = [false, 'properties differ']
          } else {
            result = eq(a[key], b[key], aStack, bStack, describe);
            if(describe && !result[0]) {
              result[1] = new FieldDifference(key, result[1]);
            }
          }
          if (!result[0]) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result[0]) {
        for (key in b) {
          if (b.hasOwnProperty(key) && !(size--)) break;
        }
        result = [!size, 'properties differ'];
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  var FieldDifference = function(field, desc) {
    this.field = field;
    this.desc = desc;
    
  }
  FieldDifference.prototype.toString = function() {
    var ret = "objects differ at property '" + this.field;
    var desc = this.desc;
    while (desc instanceof FieldDifference) {
      ret += "." + desc.field;
      desc = desc.desc;
    }
    ret += "'";
    if (desc != null) ret += ": " + desc;
    return ret;
  }

}
