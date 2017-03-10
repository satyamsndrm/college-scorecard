var tagalong = require('tagalong');
var d3 = require('d3');
var querystring = require('querystring');

module.exports = function compare() {

  var loadable = d3.select('.loadable');
  var compareRoot = document.querySelector('.compare-schools');

  // if schools were shared by querystring, compare those instead of any local school picks
  var qs = querystring.parse(location.search.substr(1));
  var compareSchools = (qs['schools[]']) ? qs['schools[]'] : picc.school.selection.all('compare');

  var showError = function (error) {
    console.error('error:', error);
    var message = compareRoot.querySelector('.error-message');
    if (typeof error.responseText != "undefined") {
      var errorText = JSON.parse(error.responseText);
      error = errorText.errors[0].message;
    }

    message.textContent = String(error) || 'There was an unexpected API error.';
  };

  if (!compareSchools.length) {
    loadable.classed('js-error', true);
    return showError(picc.errors.NO_SCHOOLS_TO_COMPARE);
  }

  loadable.classed('js-loading', true);

  var params = {};

  params.fields = [
    // we need the id to link it
    picc.fields.ID,

    // basic display fields
    picc.fields.NAME,
    picc.fields.CITY,
    picc.fields.STATE,
    picc.fields.SIZE,
    picc.fields.LOCALE,
    // to get "public" or "private" control
    picc.fields.OWNERSHIP,
    // to get the "four_year" or "lt_four_year" bit
    picc.fields.PREDOMINANT_DEGREE,
    // get all of the net price values
    picc.fields.NET_PRICE,
    picc.fields.COMPLETION_RATE,
    picc.fields.REPAYMENT_RATE,
    // this has no sub-fields
    picc.fields.MEDIAN_EARNINGS,
    picc.fields.RETENTION_RATE + '.four_year.full_time',
    picc.fields.RETENTION_RATE + '.lt_four_year.full_time',
    // not sure if we need this, but let's get it anyway
    picc.fields.EARNINGS_GT_25K,
    picc.fields.PART_TIME_SHARE,
    // under investigation flag
    picc.fields.UNDER_INVESTIGATION
  ].join(',');

  var directives = picc.data.selectKeys(picc.school.directives, [
    'name',
    'years',
    'control',
    'size_number',
    'locale_name',
    'size_category',
    'average_cost',
    'average_cost_meter',
    'grad_rate',
    'grad_rate_meter',
    'average_salary',
    'average_salary_meter',
    'repayment_rate_meter',
    'repayment_rate_percent',
    'retention_rate_value',
    'retention_rate_meter',
    'full_time_value'

  ]);

  var meterWrapper = picc.data.selectKeys(picc.school.directives, [
    'average_line'
  ]);


  // build query for API call
  function buildQuery (schools) {
    var query = {};
    schools.map(function (school) {
      var id = +school.schoolId || +school;
      query['s'+id] = [picc.API.getSchool, id, params];

    });
    return query;
  }


  function onChange() {

    compareSchools = (qs['schools[]']) ? qs['schools[]'] : picc.school.selection.all('compare');

    // build query for API call
    query = buildQuery(compareSchools);

    picc.API.getAll(query, function (error, data) {

      loadable.classed('js-loading', false);

      if (error) {
        console.error('getAll error:', error);
      }

      console.info('got schools:', data);

      var school = {};
      school.results = [];

      Object.keys(data).forEach(function (key) {
        if (data[key]) {
          school.results.push(data[key]);
        }
      });

      if (!school.results.length) {
        loadable.classed('js-error', true);
        loadable.classed('js-loaded', false);
        return showError(picc.errors.NO_SUCH_SCHOOL);
      }
      loadable.classed('js-error', false);
      loadable.classed('js-loaded', true);


      /*
       * XXX this avoids a nasty hard crash in IE11, which seems to have some
       * problems with tagalong's data joining algorithm (and/or, you know,
       * it's just broken).
       *
       * Removing the children of the results list after it's already been
       * rendered (iff `alreadyLoaded` is true) guarantees that tagalong has
       * stashed a reference to the template node. On the compare page, clone
       * template references are needed as we have nested templates.
       *
       * Note: we _don't_ do this in other browsers because it has performance
       * implications. Rendering will be much faster when the existing nodes
       * are reused and modified in place, rather than being cloned anew each
       * time.
       */

      var root = document.querySelectorAll('.compare-container_group');

      if (picc.ui.ie && picc.ui.alreadyLoaded) {

        [].slice.call(root).forEach(function(node) {
          var section = node.querySelector('.section-card_container-compare').cloneNode(true);
          var avg = node.querySelector('.average_line').cloneNode(true);
          picc.ui.removeAllChildren(node);
          node.appendChild(avg);
          var addedAvg = node.querySelector('.average_line');
          addedAvg.parentNode.insertBefore(section, addedAvg.nextSibling);
        });

      }

      var sections = document.querySelectorAll('.section-card_container-compare');

      [].slice.call(sections).forEach(function(node){
        tagalong(node, school.results, directives);
      });

      [].slice.call(root).forEach(function (node) {
        tagalong(node, {}, meterWrapper);
      });

      picc.ui.alreadyLoaded = true;

    });

  }

  /**
   * add event listeners for school selection click events and fetch new results
   */
  picc.ready(function() {

    // wait for ready to avoid IE remembering checkbox state
    picc.school.selection.renderCompareToggles();

    // initial display
    onChange();

    var compareBox = 'data-school';
    picc.delegate(
      document.body,
      // if the element matches '[data-school]'
      function() {
        return this.parentElement.hasAttribute(compareBox) ||
          this.hasAttribute(compareBox);
      },
      {
        click: picc.debounce(function(e) {
          picc.school.selection.toggle(e);
          onChange();
        },100)
      }
    );

  });
  var win = d3.select(window);
  // close other toggles when one opens
  var toggles = d3.selectAll('.toggle-accordion')
    .on('open', function() {
      var opened = this;
      toggles.each(function() {
        if (this !== opened) this.close();
      });

      var event = 'click.toggle';
      win.on(event, function() {
        if (!opened.contains(d3.event.target)) {
          win.on(event, null);
          opened.close();
        }
      });

    });

  // close all toggles on escape
  win.on('keyup.toggle', function() {
    if (d3.event.keyCode === 27) {
      toggles.property('expanded', false);
    }
  });


};