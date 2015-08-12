'use strict';

var _ = require('underscore');
var utils = require('./utils');
var appData = require('./app_data');
var highlighter = require('../highlighter');
var logger = require('../../utils/logger');

function getClosestView(elem) {
  var view = null;
  var wrapper = utils.closest(elem, 'js-view-list-item');
  if (wrapper) {
    view = appData.views[wrapper.getAttribute('data-id')];
  }
  return view;
}

function updateSelectedView() {
  appData.selectedView.vdomTemplate = appData.selectedView.obj.getVdomTemplate();
  var diff = appData.selectedView.obj.getTemplateDiff();
  if (diff.indexOf('<ins>') + diff.indexOf('<del>') > -2) {
    appData.selectedView.templateDiff = diff;
  } else {
    appData.selectedView.templateDiff = 'No difference';
  }
  utils.render();
}

module.exports = function() {
  utils.addEvent('js-toggle-view-children', 'click', function(e) {
    e.stopPropagation();
    var view = getClosestView(e.target);
    view.collapsed = !view.collapsed;
    utils.render();
  });
  utils.addEvent('js-view-list-item', 'click', function(e) {
    if (appData.selectedView) {
      appData.selectedView.obj.off('rendered', utils.render);
    }
    appData.selectedView = getClosestView(e.target);
    appData.selectedView.obj.on('rendered', updateSelectedView);
    var cids = _.keys(appData.views);
    for (var i = 0; i < cids.length; i++) {
      appData.views[cids[i]].selected = appData.views[cids[i]].obj === appData.selectedView;
    }
    updateSelectedView();
  });
  utils.addEvent('js-view-list-item', 'mouseover', function(e) {
    var view = getClosestView(e.target).obj;
    highlighter(view.el, view.getDebugName());
  });
  utils.addEvent('js-view-list-item', 'mouseout', function() {
    highlighter(null);
  });
  utils.addEvent('js-view-element', 'click', function() {
    logger.log(appData.selectedView.obj.el);
  });
  utils.addEvent('js-more-view-info', 'click', function(e) {
    var view = getClosestView(e.target).obj;
    logger.log(view);
  });
  utils.addEvent('js-view-event', 'click', function(e) {
    var selector = e.currentTarget.getAttribute('data-event-selector');
    logger.log(selector, appData.selectedView.obj.getEventFunction(selector));
  });
  utils.addEvent('js-track-function', 'click', function(e) {
    var fnName = e.currentTarget.getAttribute('data-fn');
    var selectedFunction = _.findWhere(appData.selectedView.objectFunctions, {name: fnName});
    selectedFunction.tracked = !selectedFunction.tracked;
    appData.selectedView.toggleFunctionTracking(fnName, selectedFunction.tracked);
    utils.render();
  });
  utils.addEvent('js-show-inherited', 'change', function(e) {
    appData.showInheritedMethods = e.currentTarget.checked;
    utils.render();
  });
  utils.addEvent('js-model-tab', 'click', function() {
    utils.gotoTab('showModelTab');
  });
  utils.addEvent('js-add-new-event', 'blur', function(e) {
    var eventName = e.currentTarget.value;
    if (/^\s*$/.test(eventName)) {
      return;
    }
    var existing = _.findWhere(appData.selectedView.customEvents, {
      name: eventName
    });
    if (!existing) {
      var listener = utils.addListener(appData.selectedView.obj, eventName);
      appData.selectedView.customEvents.push({
        name: eventName,
        listener: listener
      });
    }
    utils.render();
  });
  utils.addEvent('js-add-new-event', 'keyup', function(e) {
    var which = (e.which || e.keyCode);
    if (which === 13) {
      e.currentTarget.blur();
    }
  });
  utils.addEvent('js-untrack-event', 'click', function(e) {
    var eventName = utils.closest(e.currentTarget, 'js-tracked-event').getAttribute('data-key');
    var events = appData.selectedView.customEvents;
    for (var i = 0; i < events.length; i++) {
      if (events[i].name === eventName) {
        utils.removeListener(appData.selectedView.obj, events[i].name, events[i].listener);
        events.splice(i, 1);
        break;
      }
    }
    utils.render();
  });
};