/**
 * Created by brian on 8/19/14.
 */

$(document).ready(function () {
    //color label boxes properly
    $('.legend-box').each(function(){
       $(this).find("div.chart-info").each(function (idx) {
           console.log($(this));
           $(this).css("background-color", dycolors[idx % dycolors.length]);
       });
    });
});




function dyToggle(graphIdx, seriesIdx, el) {
    dygraphs[graphIdx].setVisibility(seriesIdx, el.checked);
}


//TODO fix this to do it properly, its an ugly hack
function useThreads() {
    var myurl = document.URL;
    myurl = myurl + '&xaxis=1';
    window.location.replace(myurl);
}
function useTime() {
    var myurl = document.URL;
    myurl = myurl + '&xaxis=0';
    window.location.replace(myurl);
}

function hideTablesClicked() {
    //change button to show tables (and change function call)
    $('#tablesbutton').attr('onclick', 'showTablesClicked()');
    $('#tablesbutton i').text('Show Tables');
    //call hideTables
    hideTables();
}

function showTablesClicked() {
    //change button to show tables (and change function call)
    $('#tablesbutton').attr('onclick', 'hideTablesClicked()');
    $('#tablesbutton').text('Hide Tables');
    //call showTables
    showTables();
}

function hideTables() {
    for (var i = 0; i < numGraphs; i++) {
        hideTableByIDClicked(i);
    }
}

function showTables() {
    for (var i = 0; i < numGraphs; i++) {
        showTableByIDClicked(i);
    }
}

function hideTableByIDClicked(IDNum) {
    //change button to show tables (and change function call)
    $('#table' + IDNum + 'button').attr('onclick', 'showTableByIDClicked(' + IDNum + ')');
    $('#table' + IDNum + 'button i.ban-i').removeClass('fa-ban');
    //call hideTables
    hideTableByID(IDNum);
}

function showTableByIDClicked(IDNum) {
    $('#table' + IDNum + 'button').attr('onclick', 'hideTableByIDClicked(' + IDNum + ')');
    $('#table' + IDNum + 'button i.ban-i').addClass('fa-ban');
    //call hideTables
    showTableByID(IDNum);
}

function hideTableByID(tableID) {
    $('#table-' + tableID).hide(400);
}

function showTableByID(tableID) {
    $('#table-' + tableID).show(400);
}


function get_date_data(start_data) {
    var out_data = [];
    var spread_counter = 1;
    for (var i = 0; i < start_data.length; i++) {
        var temp_list = []
        for (var j = 0; j < start_data[i].length; j++) {
            if (j === 0) {
                if (even_spread) {
                    temp_list.push(spread_counter);
                    spread_counter += 1;
                } else {
                    temp_list.push(new Date(start_data[i][j]))
                }
            } else {
                temp_list.push(start_data[i][j])
            }
        }
        out_data.push(temp_list)
    }
    return out_data
}

$(function () {
    var divs = $('div[data-filterable]');
    $('.filter-input').on('keyup', function () {
        var val = $.trim(this.value.toLowerCase());
        divs.hide();
        divs.filter(function () {
            return $(this).data('filterable').search(val) >= 0
        }).show();
    });
});

function date_graph(graphName, data, labels, num_map) {
    return new Dygraph(
        $('#graph_' + graphName)[0],
        get_date_data(data), {
            hideOverlayOnMouseOut: false,
            labels: labels,
            strokeWidth: 3, //width of lines connecting data points
            colors: dycolors,
            labelsDiv: "graph-labels-" + graphName,
            includeZero: true, //ensure y-axis starts at 0
            xRangePad: 5,
            errorBars: true,
            fillAlpha: 0.50,
            showLabelsOnHighlight: true,
            connectSeparatedPoints: true,
            axes: {
                x: {
                    axisLabelFormatter: function (x) {
                        var xval = parseFloat(x);
                        var xfloor = parseInt(x);
                        if (xval === xfloor) {
                            return num_map[xval];
                        } else {
                            return "";
                        }
                    },
                    valueFormatter: function (x) {
                        return num_map[x];
                    }
                }
            },
            xlabel: 'Commit Date' //label for x-axis
        });
}

function thread_graph(graphName, data, labels, num_map) {
    return new Dygraph(
        $('#graph_' + graphName)[0],
        data,
        {
            hideOverlayOnMouseOut: false,
            labels: labels,
            strokeWidth: 3, //width of lines connecting data points
            colors: dycolors,
            labelsDiv: "graph-labels-" + graphName,
            includeZero: true, //ensure y-axis starts at 0
            xRangePad: 5,
            errorBars: true,
            fillAlpha: 0.50,
            showLabelsOnHighlight: true,
            connectSeparatedPoints: true,
            xlabel: 'Threads' //label for x-axis
        });
}

/**
 * author Remy Sharp
 * url http://remysharp.com/2009/01/26/element-in-view-event-plugin/
 */
$(function () {
    function getViewportHeight() {
        var height = window.innerHeight; // Safari, Opera
        var mode = document.compatMode;

        if ((mode || !$.support.boxModel)) { // IE, Gecko
            height = (mode == 'CSS1Compat') ?
                document.documentElement.clientHeight : // Standards
                document.body.clientHeight; // Quirks
        }

        return height;
    }

    $(window).scroll(function () {
        var vpH = getViewportHeight(),
            scrolltop = (document.documentElement.scrollTop ?
                document.documentElement.scrollTop :
                document.body.scrollTop),
            elems = [];

        // naughty, but this is how it knows which elements to check for
        $.each($.cache, function () {
            if (this.events && this.events.inview) {
                elems.push(this.handle.elem);
            }
        });

        if (elems.length) {
            $(elems).each(function () {
                var $el = $(this),
                    top = $el.offset().top,
                    height = $el.height(),
                    inview = $el.data('inview') || false;

                if (scrolltop > (top + height) || scrolltop + vpH < top) {
                    if (inview) {
                        $el.data('inview', false);
                        $el.trigger('inview', [ false ]);
                    }
                } else if (scrolltop < (top + height)) {
                    if (!inview) {
                        $el.data('inview', true);
                        $el.trigger('inview', [ true ]);
                    }
                }
            });
        }
    });

    // kick the event to pick up any elements already in view.
    // note however, this only works if the plugin is included after the elements are bound to 'inview'
    $(function () {
        $(window).scroll();
    });

    $('').one('inview', function (event, visible) {
        if (visible) {
            $(this).text('Single bound found - I won\'t change again.');
        }
    });
});

