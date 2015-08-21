'use strict';

var _ = require('underscore');
var Autofocus = require('./hooks/autofocus');

/**
 * Map of attribute to property transforms
 * Templates use attribute name, but virtual-dom references properties first
 * @type {Object}
 */
var propertiesToTransform = {
  // transformed name
  'class': 'className',
  'for': 'htmlFor',
  'http-equiv': 'httpEquiv',
  // case specificity
  'accesskey': 'accessKey',
  'cellspacing': 'cellSpacing',
  'cellpadding': 'cellPadding',
  'colspan': 'colSpan',
  'contenteditable': 'contentEditable',
  'contextmenu': 'contextMenu',
  'formnovalidate': 'formNoValidate',
  'frameborder': 'frameBorder',
  'maxlength': 'maxLength',
  'novalidate': 'noValidate',
  'readonly': 'readOnly',
  'rowspan': 'rowSpan',
  'tabindex': 'tabIndex',
  'usemap': 'useMap'
};
/**
 * Returns property name to use or false if it should be treated as attribute
 * @param  {String}         attributeName Attribute to assign
 * @return {String|Boolean}               False if it should be an attribute, otherwise property name
 */
function transformPropertyName(attributeName) {
  if (propertiesToTransform[attributeName]) {
    return propertiesToTransform[attributeName];
  }
  // Data attributes are a special case..
  // Persisting them as attributes as they are often accessed via jQuery (i.e. data-click-location)
  // Use the nested attributes hash to avoid datasets because IE
  if (attributeName.substr(0, 5) === 'data-') {
    return false;
  }
  return attributeName;
}

module.exports = function processProperties(properties, options) {
  var opts = options || {};
  // Attribute only mode is only used for the toString method, so no processing is needed
  if (opts.attributesOnly) {
    return {
      attributes: properties
    };
  }

  var propertyNames = _.keys(properties);
  var result = {};

  // Defaulting contentEditable to 'inherit'
  // If an element goes from an explicitly set value to null, it will use this value rather than error
  var hasContentEditable = false;

  for (var i = 0; i < propertyNames.length; i++) {
    var propName = propertyNames[i];
    var propValue = properties[propName];
    var lowerPropName = propName.toLowerCase();
    var transformedName = transformPropertyName(lowerPropName);

    if (lowerPropName === 'contenteditable') {
      hasContentEditable = true;
    }

    if (opts.useHooks) {
      if (lowerPropName === 'autofocus') {
        propValue = new Autofocus();
      }
    }

    if (transformedName === false) {
      if (!result.attributes) {
        result.attributes = {};
      }
      result.attributes[propName] = propValue;
    } else if (lowerPropName === 'style') {
      var rules = {};
      if (typeof propValue === 'string') {
        // Handle parsing style tags into CSS rules
        // @TODO: expand parsing to avoid "changing" all rules whenever any rule changes
        rules = {
          cssText: propValue
        };
      } else {
        rules = propValue;
      }
      result.style = rules;
    } else {
      result[transformedName] = propValue;
    }
  }

  if (!hasContentEditable) {
    result.contentEditable = 'inherit';
  }

  return result;
};