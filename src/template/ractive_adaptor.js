'use strict';

var _ = require('underscore');
var ToString = require('./to_string');
var Context = require('./template_context');
var logger = require('./../utils/logger');
var ractiveTypes = require('./ractive_types');
var virtualDomImplementation = require('../vdom/virtual_dom_implementation');
var isWidget = virtualDomImplementation.isWidget;
var isVNode = virtualDomImplementation.isVNode;

var htmlToVdom = require('./html_to_vdom');

var whitespaceOnlyRegex = /^\s*$/;
/**
 * Used to parse loose interpolators inside a opening tag
 * @param  {Object}  templates Template object
 * @param  {Context} context   current Context to evaluate in
 * @return {Object}            Parsed dictionary of attribute names/values
 */
function parseStringAttrs(templates, context) {
  var stringAttrs = '';
  var toString = new ToString();
  for (var i = 0; i < templates.length; i++) {
    toString.clear();
    render(toString, templates[i], context);
    stringAttrs += ' ' + toString.getOutput() + ' ';
  }
  if (whitespaceOnlyRegex.test(stringAttrs)) {
    return null;
  }
  var node = htmlToVdom('<div ' + stringAttrs + '></div>');
  return node.properties.attributes;
}

/**
 * Render the value of an element's attribute
 * @param  {String|Object} values  VTree object for the attribute value
 * @param  {Context}       context current Context to evaluate in
 * @return {String}                String value for the attribute
 */
function renderAttributeString(values, context) {
  if (typeof values === 'string') {
    return values;
  }

  var buffer = '';
  var toString = new ToString();
  for (var i = 0; i < values.length; i++) {
    toString.clear();
    render(toString, values[i], context);
    buffer += toString.getOutput();
  }

  return buffer;
}

/**
 * Recursive function to render Template into VDom format
 * @param  {Object}  stack       Object collecting output
 * @param  {Object}  template    Template to render
 * @param  {Context} context     Value for the current rendering context
 * @param  {Object}  partials    Object map of partial templates
 * @param  {Object}  parentView  ParentView to attach widgets to
 */
function render(stack, template, context, partials, parentView) {
  var i, j, value, valueLength;
  if (typeof template === 'undefined') {
    return;
  } else if (typeof template === 'string') {
    stack.createObject(template);
  } else if (Context.isArray(template)) {
    for (i = 0; i < template.length; i++) {
      render(stack, template[i], context, partials, parentView);
    }
  } else if (template.type === 'Widget') {
    // Widgets are how we attach Views to subtrees
    // If we have a parentView, we're rendering Vdom, if not this is rendering to Dom or string, so ignore
    if (parentView) {
      // If we have a parent view, attach this as a widget so the child view will render and attach
      stack.createObject(new template.constructor(template.template, template.childView, context, parentView));
    } else {
      // If we aren't in the context of a view, just render out the widget without attaching the child view
      template.template._render(null, context, null, null, stack);
    }
    return;
  }

  switch (template.t) {
    // <!-- comment -->
    case ractiveTypes.COMMENT:
      var toString = new ToString();
      render(toString, template.c, context, partials, parentView);
      stack.createComment(toString.getOutput());
      return;
    // {{value}} or {{{value}}} or {{& value}}
    case ractiveTypes.INTERPOLATOR:
    case ractiveTypes.TRIPLE:
      value = context.lookup(Context.getInterpolatorKey(template), stack);
      if (value != null) {
        // If value is already a widget or vnode, add it wholesale
        if (template.t === ractiveTypes.TRIPLE && (isWidget(value) || isVNode(value))) {
          stack.createObject(value);
        } else {
          stack.createObject(value.toString(), {
            // TRIPLE is unescaped content, so it may need parsing
            parse: template.t === ractiveTypes.TRIPLE,
            // INTERPOLATOR is escaped content, so it may need escaping
            escape: template.t === ractiveTypes.INTERPOLATOR
          });
        }
      }
      break;

    // {{> partial}}
    case ractiveTypes.PARTIAL:
      var partialName = Context.getInterpolatorKey(template);
      if (partials[partialName]) {
        var partialTemplate = partials[partialName];
        if (partialTemplate._render) {
          // @Todo determine if using partial context is necessary
          partialTemplate._render(null, context, parentView, partials, stack);
        } else {
          render(stack, partialTemplate, context, partials[partialName].partials || partials, parentView);
        }
      } else {
        // @TODO, perhaps return this string as the partial result so it renders to the page?
        logger.warn('Warning: no partial registered with the name ' + partialName);
      }
      break;

    // {{# section}} or {{^ unless}}
    case ractiveTypes.SECTION:
      value = Context.parseValue(context.lookup(Context.getInterpolatorKey(template), stack));
      if (template.n === ractiveTypes.SECTION_UNLESS) {
        if (!value.isTruthy) {
          render(stack, template.f, context, partials, parentView);
        }
      } else if (value.isTruthy) {
        // Sections become loops if an array or collection is passed
        if (value.isArray) {
          // Iterate over the collection
          for (j = 0, valueLength = value.value.length; j < valueLength; ++j) {
            render(stack, template.f, context.push(value.value[j]), partials, parentView);
          }
        } else if (typeof value.value === 'object' || typeof value.value === 'string') {
          // If the found value is an object or string, push it onto the context
          render(stack, template.f, context.push(value.value), partials, parentView);
        } else {
          // Not an object or string usually means boolean, so don't bother pushing that
          render(stack, template.f, context, partials, parentView);
        }
      }
      break;

    // DOM node
    case ractiveTypes.ELEMENT:
      var properties = {};
      var attributeHandler = function(values, attr) {
        properties[attr] = renderAttributeString(values, context);
      };

      // Parse static attribute values
      _.each(template.a, attributeHandler);
      // Handle dynamic values if need be
      if (template.m) {
        var attrs = parseStringAttrs(template.m, context);
        if (attrs != null) {
          _.each(attrs, attributeHandler);
        }
      }

      stack.openElement(template.e, properties);

      // Recuse into the elements' children
      var children = [];
      if (template.f) {
        children = render(stack, template.f, context, partials, parentView);
      }

      stack.closeElement();
  }
}

module.exports = render;