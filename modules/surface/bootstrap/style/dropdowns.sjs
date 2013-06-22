var { scope, darken } = require('../../css');

exports.css = function(vars, mixins) {
  vars = vars || require('../variables').defaultLookAndFeel;
  mixins = mixins || require('../mixins').Mixins(vars);

  var rv = "\
/* Use the .menu class on any <li> element within the topbar or ul.tabs and you'll get some superfancy dropdowns */
.dropup,
.dropdown {
  position: relative;
}
.dropdown-toggle {
  /* The caret makes the toggle a bit too tall in IE7 */
  *margin-bottom: -3px;
}
.dropdown-toggle:active,
.open .dropdown-toggle {
  outline: 0;
}

/* Dropdown arrow/caret */
/* -------------------- */
.caret {
  display: inline-block;
  width: 0;
  height: 0;
  vertical-align: top;
  border-top:   4px solid #{vars.black()};
  border-right: 4px solid transparent;
  border-left:  4px solid transparent;
  content: '';
}

/* Place the caret */
.dropdown .caret {
  margin-top: 8px;
  margin-left: 2px;
}

/* The dropdown menu (ul) */
/* ---------------------- */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: #{vars.zindexDropdown()};
  display: none; /* none by default, but block on 'open' of the menu */
  float: left;
  min-width: 160px;
  padding: 5px 0;
  margin: 2px 0 0; /* override default ul */
  list-style: none;
  background-color: #{vars.dropdownBackground()};
  border: 1px solid #ccc; /* Fallback for IE7-8 */
  border: 1px solid #{vars.dropdownBorder()};
  *border-right-width: 2px;
  *border-bottom-width: 2px;
  #{mixins.border_radius('6px')}
  #{mixins.box_shadow('0 5px 10px rgba(0,0,0,.2)')}
  -webkit-background-clip: padding-box;
     -moz-background-clip: padding;
          background-clip: padding-box;
}
  /* Aligns the dropdown menu to right */
.dropdown-menu.pull-right {
    right: 0;
    left: auto;
}

  /* Dividers (basically an hr) within the dropdown */
.dropdown-menu .divider {
    #{mixins.nav_divider(vars.dropdownDividerTop(), vars.dropdownDividerBottom())}
}

  /* Links within the dropdown menu */
.dropdown-menu > li > a {
    display: block;
    padding: 3px 20px;
    clear: both;
    font-weight: normal;
    line-height: #{vars.baseLineHeight()};
    color: #{vars.dropdownLinkColor()};
    white-space: nowrap;
}

/* Hover/Focus state */
/* ----------- */
.dropdown-menu li > a:hover,
.dropdown-menu li > a:focus,
.dropdown-submenu:hover > a,
.dropdown-submenu:focus > a {
  text-decoration: none;
  color: #{vars.dropdownLinkColorHover()};
  #{ mixins.gradient.vertical(vars.dropdownLinkBackgroundHover(), 
                              vars.dropdownLinkBackgroundHover() .. darken(.05))}
}

/* Active state */
/* ------------ */
.dropdown-menu > .active > a,
.dropdown-menu > .active > a:hover,
.dropdown-menu > .active > a:focus {
  color: #{vars.dropdownLinkColorActive()};
  text-decoration: none;
  outline: 0;
  #{ mixins.gradient.vertical(vars.dropdownLinkBackgroundActive(), 
                              vars.dropdownLinkBackgroundActive() .. darken(.05))}
}

/* Disabled state */
/* -------------- */
/* Gray out text and ensure the hover/focus state remains gray */
.dropdown-menu > .disabled > a,
.dropdown-menu > .disabled > a:hover,
.dropdown-menu > .disabled > a:focus {
  color: #{vars.grayLight()};
}
// Nuke hover/focus effects
.dropdown-menu > .disabled > a:hover,
.dropdown-menu > .disabled > a:focus {
  text-decoration: none;
  background-color: transparent;
  background-image: none; /* Remove CSS gradient */
  #{mixins.reset_filter()}
  cursor: default;
}

/* Open state for the dropdown */
/* --------------------------- */
.open {
  /* IE7's z-index only goes to the nearest positioned ancestor, which would */
  /* make the menu appear below buttons that appeared later on the page */
  *z-index: #{vars.zindexDropdown()};
}
.open > .dropdown-menu {
    display: block;
}

/* Right aligned dropdowns */
/* --------------------------- */
.pull-right > .dropdown-menu {
  right: 0;
  left: auto;
}

/* Allow for dropdowns to go bottom up (aka, dropup-menu) */
/* ------------------------------------------------------ */
/* Just add .dropup after the standard .dropdown class and you're set, bro. */
/* TODO: abstract this so that the navbar fixed styles are not placed here? */
.dropup,
.navbar-fixed-bottom .dropdown {
}
  /* Reverse the caret */
.dropup .caret,
.navbar-fixed-bottom .dropdown .caret {
    border-top: 0;
    border-bottom: 4px solid #{vars.black()};
    content: '';
}
  /* Different positioning for bottom up menu */
.dropup .dropdown-menu,
.navbar-fixed-bottom .dropdown .dropdown-menu {
    top: auto;
    bottom: 100%;
    margin-bottom: 1px;
}

/* Sub menus */
/* --------------------------- */
.dropdown-submenu {
  position: relative;
}
/* Default dropdowns */
.dropdown-submenu > .dropdown-menu {
  top: 0;
  left: 100%;
  margin-top: -6px;
  margin-left: -1px;
  #{mixins.border_radius('0 6px 6px 6px')}
}
.dropdown-submenu:hover > .dropdown-menu {
  display: block;
}

/* Dropups */
.dropup .dropdown-submenu > .dropdown-menu {
  top: auto;
  bottom: 0;
  margin-top: 0;
  margin-bottom: -2px;
  #{mixins.border_radius('5px 5px 5px 0')}
}

/* Caret to indicate there is a submenu */
.dropdown-submenu > a:after {
  display: block;
  content: ' ';
  float: right;
  width: 0;
  height: 0;
  border-color: transparent;
  border-style: solid;
  border-width: 5px 0 5px 5px;
  border-left-color: #{darken(vars.dropdownBackground(), .2)};
  margin-top: 5px;
  margin-right: -10px;
}
.dropdown-submenu:hover > a:after {
  border-left-color: #{vars.dropdownLinkColorHover()};
}

/* Left aligned submenus */
.dropdown-submenu.pull-left {
  /* Undo the float */
  /* Yes, this is awkward since .pull-left adds a float, but it sticks to our conventions elsewhere. */
  float: none;
}
  /* Positioning the submenu */
.dropdown-submenu.pull-left > .dropdown-menu {
    left: -100%;
    margin-left: 10px;
    #{mixins.border_radius('6px 0 6px 6px')}
}

/* Tweak nav headers */
/* ----------------- */
/* Increase padding from 15px to 20px on sides */
.dropdown .dropdown-menu .nav-header {
  padding-left: 20px;
  padding-right: 20px;
}


/* Typeahead */
/* --------- */
.typeahead {
  z-index: 1051;
  margin-top: 2px; /* give it some space to breathe */
  #{mixins.border_radius(vars.baseBorderRadius())}
}
";

  return rv;
};