/**
  @nodoc
  @noindex
  (documented as mho:surface)
 */

//----------------------------------------------------------------------
// dynamic surface:
// if hostenv == xbrowser

var { ensureElement, Mechanism, collapseHtmlFragment, isSentinelNode } = require('./base');
var { propertyPairs, keys, merge } = require('sjs:object');
var { isStream, Stream, toArray, map, filter, each, reverse, concat, first, take, indexed, takeWhile } = require('sjs:sequence');
var { split } = require('sjs:string');
var { wait, when } = require('sjs:event');

//----------------------------------------------------------------------
// global ref counted resource registry that adds/removes resources to
// the document
var stylesInstalled = {};
var mechanismsInstalled = {};

var resourceRegistry = {
  useStyleDefs: function(defs) {
    propertyPairs(defs) .. each {
      |[id, [cnt,def]]|
      var desc;
      if (!(desc = stylesInstalled[id])) {
        desc = stylesInstalled[id] = { ref_count: cnt, elem: def.createElement(), mechanism: def.mechanism };
        (document.head || document.getElementsByTagName("head")[0] /* IE<9 */).appendChild(desc.elem);
        if (desc.mechanism) {
          desc.elem.__oni_mech = spawn(desc.mechanism.call(desc.elem, desc.elem));
        }
        if (def.waitforLoading) {
          // wait for stylesheet to load for an arbitrary maximum of 2s; 
          // display warning in console if it hasn't loaded by then.
          // XXX we should refactor the code to allow loading of stylesheets in parallel!
          waitfor {
            desc.elem .. wait('load');
          }
          or {
            hold(2000);
            console.log("Warning: Stylesheet #{def} taking long to load");
          }
        }
      }
      else {
        desc.ref_count += cnt;
      }
    }   
  },
  unuseStyleDefs: function(defs) {
    keys(defs) .. each { 
      |id|
      this.unuseStyle(id);
    }
  },
  unuseStyle: function(id) {
    var desc = stylesInstalled[id];
    if (!desc) { console.log("Warning: Trying to unuse unknown style #{id}"); return; }
    if (--desc.ref_count === 0) {
      if (desc.elem.__oni_mech) {
        desc.elem.__oni_mech.abort();
        delete desc.elem.__oni_mech;
      }
      // XXX might actually want to cache this for a while
      desc.elem.parentNode.removeChild(desc.elem);
      delete stylesInstalled[id];
    }
  },
  // XXX no real need to go through the whole use/unuse machinery for
  // typeof code == function
  useMechanisms: function(mechs) {
    propertyPairs(mechs) .. each {
      |[id, code]|
      var desc;
      if (!(desc = mechanismsInstalled[id])) {
        desc = mechanismsInstalled[id] = {
          ref_count: 1,
          func: (typeof code === 'function') ? 
            code :
            require('builtin:apollo-sys').eval("(function(){#{code}})")
        };
      }
      else {
        ++desc.ref_count;
      }
    }
  },
  unuseMechanisms: function(ids) {
    ids .. each {
      |id|
      var desc = mechanismsInstalled[id];
      /*
        XXX: we don't actually want to purge the mechanism immediately... we want
        to cache mechanisms for a while -
        implement lru caching or something similar
      */

      if (--desc.ref_count === 0) {
        delete mechanismsInstalled[id];
      }
    }
  }
};
exports.resourceRegistry = resourceRegistry;


//----------------------------------------------------------------------
// main dynamic api

// helpers

function stopMechanisms(parent, include_parent) {
  var nodes = StreamNodes(parent);
  if (parent.querySelectorAll)
    nodes = concat(parent.querySelectorAll('._oni_mech_'), nodes);
  if (include_parent)
    nodes = concat([parent], nodes);

  nodes .. each {
    |node|
    if (!node.__oni_mechs) continue;
    node.__oni_mechs .. each {
      |stratum|
      stratum.abort();
    }
    delete node.__oni_mechs;
  }
}

function unuseStyles(elems) {
  elems .. each {
    |elem|
    (elem.getAttribute('class')||'') .. split(' ') .. each {
      |cls|
      var matches = /_oni_style(\d+)_/.exec(cls);
      if (!matches) continue;
      resourceRegistry.unuseStyle(matches[1]);
    }
  }
}

// XXX DOM module backfill?
// returns a stream of comment nodes:
function CommentNodes(node) {
  return Stream(function(r) {
    if (node.nodeType !== 1 /*ELEMENT_NODE*/) return;
    var walker = document.createTreeWalker(
      node, NodeFilter.SHOW_COMMENT, null, false);
    while (walker.nextNode()) {
      r(walker.currentNode);
    }
  });
}

function StreamNodes(elem) {
  return CommentNodes(elem) .. 
    filter({nodeValue} -> nodeValue.indexOf('surface_stream')!== -1);
}

function runMechanisms(elem, content_only) {
  if (elem.nodeType == 1) {
    elem.querySelectorAll('[data-oni-mechanisms]') ..
      concat((!content_only && elem.hasAttribute('data-oni-mechanisms')) ? [elem] : []) ..
      reverse .. // we want to start mechanisms in post-order; querySelectorAll is pre-order
      each {
        |elem|
        elem.__oni_mechs = [];
        elem.getAttribute('data-oni-mechanisms').split(' ') ..
          filter .. // only truthy elements
          each {
            |mech|
            elem.__oni_mechs.push(spawn mechanismsInstalled[mech].func.call(elem, elem));
          }
      }
    
    // start streams:
    StreamNodes(elem) .. toArray .. each { 
      |node| 
      var [,mech] = node.nodeValue.split("|");
      node.__oni_mechs = [spawn mechanismsInstalled[mech].func.call(node, node)];
    }
  }
  else if (elem.nodeValue.indexOf('surface_stream') !== -1) {
    // we assume nodetype == 8 (comment node)
    var [,mech] = elem.nodeValue.split("|");
    elem.__oni_mechs = [spawn mechanismsInstalled[mech].func.call(elem,elem)];
  }
}

function insertHtml(html, doInsertHtml) {
  html = collapseHtmlFragment(html);
  
  // load external scripts:
  keys(html.getExternalScripts()) .. each {
    |url| require('sjs:xbrowser/dom').script(url);
  }

  // install styles and mechanisms
  var styles = html.getStyleDefs();
  resourceRegistry.useStyleDefs(styles);
  var mechs = html.getMechanisms();
  resourceRegistry.useMechanisms(mechs);

  try {
    doInsertHtml(html);
  }
  catch (e) {
    resourceRegistry.unuseStyleDefs(styles);
    throw e;
  }
  finally {
    // now they have been run (or not), we can tell the resource registry to
    // remove the mechanisms again
    resourceRegistry.unuseMechanisms(propertyPairs(mechs) .. map([id, code] -> id) .. toArray);
  }
}

// generate a stream of element & comment nodes between the two
// boundary points. The stream will be used to start mechanisms on
function nodes(parent, before_node, after_node) {

  // make sure we have stable reference points; text nodes get
  // collected together when we insert something
  while (before_node && 
         before_node.nodeType != 1 && 
         before_node.nodeType != 8)
    before_node = before_node.previousSibling;
  while (after_node && 
         after_node.nodeType != 1 &&
         after_node.nodeType != 8) 
    after_node = after_node.nextSibling;

  return Stream(function(r) {
    var node = before_node ? before_node.nextSibling :
      parent.firstChild;
    while (node != after_node) {
      if (node.nodeType == 1 || node.nodeType == 8) r(node);
      node = node.nextSibling;
    }
  });
}

//----------------------------------------------------------------------

/**
   @function replaceContent
   @altsyntax parent_element .. replaceContent(html)
   @summary Replace the content of a DOM element with a [::HtmlFragment]
   @param {DOMElement} [parent_element] 
   @param {::HtmlFragment} [html] Html to insert
   @desc
     ### Example:

         document.body .. replaceContent(`<h1>Hello, world</h1>`)
*/
function replaceContent(parent_element, html) {
  insertHtml(html, function(html) {
    stopMechanisms(parent_element);
    parent_element.querySelectorAll('._oni_style_') .. unuseStyles();

    parent_element.innerHTML = html.getHtml();

    parent_element .. runMechanisms(true);
  });
}
exports.replaceContent = replaceContent;


/**
   @function appendContent
   @altsyntax parent_element .. appendContent(html) { |node1, node2, ...| ... }
   @summary Append a [::HtmlFragment] to a DOM element's content
   @param {DOMElement} [parent_element] 
   @param {::HtmlFragment} [html] Html to append
   @param {optional Function} [block] Function bounding lifetime of appended content
   @return {Array|void} `void` if `block` has been provided; array of inserted DOM nodes otherwise

   @desc

     * If no function `block` is provided, `appendContent` returns an
       array containing the DOM elements and comment nodes that have
       been appended. Note that this array does not contain any
       top-level text that has been inserted.

     * If a function (or blocklambda) `block` is provided, it will be passed as arguments
       the DOM elements and comment nodes that have been appended. When `block` 
       exits (normally, by exception or by retraction), the appended nodes will be removed.
       Any [::Mechanism]s running on the inserted nodes will be aborted.

     * When using the `block`-form of `appendContent`, note that only
       inserted DOM *elements* and comment nodes will be cleaned up,
       not text nodes. In particular this means that inserted
       top-level text content will remain in the document after
       `block` returns.  E.g. when appending the fragment

           `foo<div>bar</div>baz`

       only the `<div>` will be removed after `block` returns. "foo" and "baz" will 
       remain in the document. This behaviour might change in future versions of conductance.

     ### Examples:

         document.body .. appendContent(
           `<div>This will show for only 5 seconds</div>`) {
           ||
           hold(5000); // wait 5s
         }

         document.body .. appendContent(
           `<button>foo</button>
            <button>bar</button>`) {
            |foo_elem, bar_elem|
            // 'foo_elem' and 'bar_elem' contain the DOM elements of the respective buttons
            ...
         }
*/
function appendContent(parent_element, html, block) {
  var inserted_nodes = nodes(parent_element, parent_element.lastChild, null);
  
  insertHtml(html, function(html) {
    parent_element.insertAdjacentHTML('beforeend', html.getHtml());
    
    inserted_nodes = inserted_nodes .. toArray;
    inserted_nodes .. each(runMechanisms);
  });

  if (block) {
    try {
      return block.apply(null, inserted_nodes);
    }
    finally {
      inserted_nodes .. each(removeNode);
    }
  }
  else
    return inserted_nodes;
}
exports.appendContent = appendContent;

/**
   @function prependContent
   @altsyntax parent_element .. prependContent(html) { |node1, node2, ...| ... }
   @summary Prepend a [::HtmlFragment] to a DOM element's content
   @param {DOMElement} [parent_element] 
   @param {::HtmlFragment} [html] Html to prepend
   @param {optional Function} [block] Function bounding lifetime of prepended content
   @return {Array|void} `void` if `block` has been provided; array of inserted DOM nodes otherwise

   @desc
     * See [::appendContent] for notes on the semantics and return value.
*/
function prependContent(parent_element, html, block) {
  var inserted_nodes = nodes(parent_element, null, parent_element.firstChild);

  insertHtml(html, function(html) {
    parent_element.insertAdjacentHTML('afterbegin', html.getHtml());

    inserted_nodes = inserted_nodes .. toArray;
    inserted_nodes .. each(runMechanisms);
  });

  if (block) {
    try {
      return block.apply(null, inserted_nodes);
    }
    finally {
      inserted_nodes .. each(removeNode);
    }
  }
  else
    return inserted_nodes;
}
exports.prependContent = prependContent;

/**
   @function insertBefore
   @altsyntax sibling_node .. insertBefore(html) { |node1, node2, ...| ... }
   @summary Insert a [::HtmlFragment] before the given sibling node
   @param {DOMNode} [sibling_node] Sibling before which to insert
   @param {::HtmlFragment} [html] Html to insert
   @param {optional Function} [block] Function bounding lifetime of inserted content
   @return {Array|void} `void` if `block` has been provided; array of inserted DOM nodes otherwise

   @desc
     * `sibling_node` should be a DOM *element* or comment node.
     * See [::appendContent] for notes on the semantics and return value.
*/
function insertBefore(sibling, html, block) {
  var inserted_nodes = nodes(sibling.parentNode, sibling.previousSibling, sibling);

  insertHtml(html, function(html) {
    if (sibling.insertAdjacentHTML)
      sibling.insertAdjacentHTML('beforebegin', html.getHtml());
    else { 
      // we're inserting before a non-element node (or on an old
      // browser without `insertAdjacentHTML` support) 
      var parent = sibling.parentNode;
      var container = document.createElement(parent.nodeName);
      container.innerHTML = html.getHtml();
      var node;
      while ((node = container.firstChild)) {
        parent.insertBefore(node, sibling);
      }
    }

    inserted_nodes =  inserted_nodes .. toArray;
    inserted_nodes .. each(runMechanisms);
  });

  if (block) {
    try {
      return block.apply(null, inserted_nodes);
    }
    finally { 
      inserted_nodes .. each(removeNode);
    }
  }
  else
    return inserted_nodes;
}
exports.insertBefore = insertBefore;

/**
   @function insertAfter
   @altsyntax sibling_node .. insertAfter(html) { |node1, node2, ...| ... }
   @summary Insert a [::HtmlFragment] after the given sibling node
   @param {DOMNode} [sibling_node] Sibling before which to insert
   @param {::HtmlFragment} [html] Html to insert
   @param {optional Function} [block] Function bounding lifetime of inserted content
   @return {Array|void} `void` if `block` has been provided; array of inserted DOM nodes otherwise

   @desc
     * `sibling_node` should be a DOM *element* or comment node.
     * See [::appendContent] for notes on the semantics and return value.
*/
function insertAfter(sibling, html, block) {
  var inserted_nodes = nodes(sibling.parentNode, sibling, sibling.nextSibling);

  insertHtml(html, function(html) {
    if (sibling.insertAdjacentHTML)
      sibling.insertAdjacentHTML('afterend', html.getHtml());
    else { console.log("WWW");
      // we're inserting before a non-element node (or on an old
      // browser without `insertAdjacentHTML` support) 
      var parent = sibling.parentNode;
      var container = document.createElement(parent.nodeName);
      container.innerHTML = html.getHtml();
      var ref = sibling.nextSibling;
      var node;
      while ((node = container.lastChild)) {
        parent.insertBefore(node, ref);
      }
    }
    inserted_nodes = inserted_nodes .. toArray;
    inserted_nodes .. each(runMechanisms);
  });

  if (block) {
    try {
      return block.apply(null, inserted_nodes);
    }
    finally {
      inserted_nodes .. each(removeNode);
    }
  }
  else
    return inserted_nodes;
}
exports.insertAfter = insertAfter;


/**
   @function removeNode
   @param {DOMNode} [node] Node to remove
   @summary Remove a DOM node from the document
   @desc
     * This function can be used to remove any DOM node from
       document - whether it has been inserted using one of the surface
       module functions ([::appendContent], etc).

     * `removeNode` will abort any [::Mechanism]s running on the node
       and release any [::Style] references.

     * Note that you can remove DOM nodes inserted using surface module functions also
       using normal DOM operations (e.g. removeChild), however any [::Mechanism]s that might
       be running on the content will not be aborted, and [::Style] references will not be 
       released. This might change in future versions of the library.
*/
function removeNode(node) { 
  // stop our mechanism and all mechanisms below us
  stopMechanisms(node, true);
  if (node.parentNode)
    node.parentNode.removeChild(node);
  
  // if node is an element, unuse our styles and all styles below us
  if (node.querySelectorAll)
    concat([node], node.querySelectorAll('._oni_style_')) ..
    unuseStyles();
}
exports.removeNode = removeNode;


//----------------------------------------------------------------------

// set a property on an element
/**
  @function Prop
  @summary Add a javascript property to an element
  @param {::HtmlFragment} [element]
  @param {String} [name] Property name
  @param {String|sjs:sequence::Stream} [value] Property value
  @return {::Element}
  @desc
    Sets a javascript property
    on the element's DOM node once it is inserted into the document.

    See also [::Attrib].
*/
function Prop(html, name, value) {
  return html .. Mechanism(function(node) {
    if (!isStream(value))
      node[name] = value;
    else {
      value .. each { |v|
        node[name] = v;
      }
    }
  });
}
exports.Prop = Prop;

//----------------------------------------------------------------------

// set an event handler:

var OnEvent = (html, event, opts, f) -> html .. Mechanism(function(node) {
  if (!f) {
    // opts not given
    f = opts;
    opts = {};
  }
  node .. when(event, {queue: true} .. merge(opts), f);
});
exports.OnEvent = OnEvent;

var OnClick = (html, opts, f) -> html .. OnEvent('click', opts, f);
exports.OnClick = OnClick;



