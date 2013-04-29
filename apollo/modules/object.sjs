/*
 * Oni Apollo 'object' module
 * Functions for working with objects
 *
 * Part of the Oni Apollo Standard Module Library
 * Version: 'unstable'
 * http://onilabs.com/apollo
 *
 * (c) 2013 Oni Labs, http://onilabs.com
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
   @module  object
   @summary Functions for working with objects
   @home    sjs:object
*/

var { each, map, Stream } = require('./sequence');
var { extendObject, mergeObjects, flatten } = require('builtin:apollo-sys');

/**
   @function keys
   @param {Object} [obj]
   @return {sequence::Stream}
   @summary  Returns a [sequence::Stream] of the names of `obj`'s enumerable properties, including those defined on `obj`'s prototype chain.
   @desc     
      See also [::ownKeys].
*/
function keys(obj) {  
  return Stream(function(r) { for (var p in obj) r(p) });
}
exports.keys = keys;

/**
   @function ownKeys
   @param {Object} [obj]
   @return {sequence::Stream}
   @summary  Returns a [sequence::Stream] of the names of `obj`'s own enumerable properties, 
             i.e. excluding those defined on `obj`'s prototype chain.
   @desc     
       Note that you can also use the ECMA-263/5 function `Object.keys` - 
       on older JS engines Apollo adds a shim to emulate this function. 

       See also [::keys].
*/
function ownKeys(obj) {  
  return Stream(function(r) { for (var p in obj) { if (Object.prototype.hasOwnProperty.call(obj, p)) r(p) } });
}
exports.ownKeys = ownKeys;


/**
  @function values
  @param    {Object} [obj]
  @return   {sequence::Stream}
  @summary  Returns a [sequence::Stream] of the values of `obj`'s enumerable properties,
            including those defined on `obj`'s prototype chain.
*/
function values(obj) {
  return keys(obj) .. map(k => obj[k]);
}
exports.values = values;

/**
  @function values
  @param    {Object} [obj]
  @return   {sequence::Stream}
  @summary  Returns a [sequence::Stream] of the values of `obj`'s enumerable properties,
            excluding those defined on `obj`'s prototype chain.
*/
function ownValues(obj) {
  return ownKeys(obj) .. map(k => obj[k]);
}
exports.ownValues = ownValues;

/**
  @function propertyPairs
  @param    {Object} [obj]
  @return   {sequence::Stream}
  @summary  Returns a [sequence::Stream] `[key1,val1], [key2,val2], ...` of `obj`'s 
            enumerable properties, including those defined on `obj`'s prototype chain.
*/
function propertyPairs(obj) {
  return keys(obj) .. map(k => [k,obj[k]]);
}
exports.propertyPairs = propertyPairs;

/**
  @function ownPropertyPairs
  @param    {Object} [obj]
  @return   {sequence::Stream}
  @summary  Returns a [sequence::Stream] `[key1,val1], [key2,val2], ...` of `obj`'s 
            enumerable properties, excluding those defined on `obj`'s prototype chain.
*/
function ownPropertyPairs(obj) {
  return ownKeys(obj) .. map(k => [k,obj[k]]);
}
exports.ownPropertyPairs = ownPropertyPairs;

/**
   @function pairsToObject
   @altsyntax sequence .. pairsToObject([prototype])
   @param {::Sequence} [sequence] Input sequence
   @param {optional Object} [prototype=null] Prototype for return object
   @summary Create an object from a [::Stream] `[key1,val1],[key2,val2],...` of property pairs
*/
function pairsToObject(sequence, prototype) {
  if (prototype === undefined) prototype = Object.prototype;
  var rv = Object.create(prototype);
  sequence .. each {
    |prop|
    rv[prop[0]] = prop[1];
  }
  return rv;
}
exports.pairsToObject = pairsToObject;

/**
   @function extend
   @altsyntax dest .. extend(source)
   @param {Object} [dest] Destination Object
   @param {Object|Array} [source] Source Object(s)
   @return {Object} `dest` object
   @summary Extend `dest` with properties from the given source object
   @desc
      * Only "own" properties will be added to *dest* - i.e no
        properties inherited via prototypes will be copied.
*/
exports.extend = extendObject;

/**
   @function merge
   @param {Object|Array} [source*] Source Object(s) or Array of Objects
   @return {Object} New object with merged properties
   @summary Merge properties from the given source objects into a new object
   @desc
      * Properties from the source objects will be merged in the order that they
        appear in the argument list. I.e. properties appearing later will override
        properties appearing in objects to the left.
      * `source` can be a multiple object arguments, or a single Array argument.
*/
exports.merge = mergeObjects;

/**
  @function clone
  @summary Shallow-clone an object or array
  @param {Object|Array} [source] Source Object or Array
  @return {Object} A new Object or Array with the same keys/values as the input.
  @desc
    The return type is a simple Object with the same keys and values - no
    prototype or class information is cloned.
    The return type when given either an Array or an `arguments` object will
    be a new Array with the same elements as `source`.
*/
exports.clone = function(obj) {
  if (require('builtin:apollo-sys').isArrayLike(obj)) {
    return Array.prototype.slice.call(obj);
  }
  return exports.extend({}, obj);
};

/**
   @function override
   @altsyntax dest .. override(source*)
   @param {Object} [dest] Destination Object
   @param {Object|Array} [source*] Source Object(s) or Array(s) of Objects
   @return {Object} `dest` object
   @summary Override properties of `dest` with properties from the given source object(s)
   @desc
      * In contrast to [::extend], only enumerable properties on `dest` (those e.g. 
        accessible by a for-in loop) will be overridden.  No other properties from 
        `source` parameters will be be copied to `dest`.
      * Properties from the source objects will be applied in the order that they
        appear in the argument list. I.e. properties appearing later will override
        properties appearing in objects to the left.
      * `source` parameters can be arbitrarily nested arrays of objects. These will be 
        flattend before the objects contained in them will be applied to `dest`.
*/
exports.override = function(/*dest, source...*/) {
  var dest = arguments[0];
  var sources = flatten(Array.prototype.slice.call(arguments, 1));
  var hl = sources.length;
  for (var o in dest) {
    for (var h=hl-1; h>=0; --h) {
      var source = sources[h];
      if (o in source) {
        dest[o] = source[o];
        break;
      }
    }
  }
  return dest;
};
