<!doctype html>
<html lang="us">
<head>
    <meta charset="utf-8">
    <title>MongoDB: mongo-perf benchmark results</title>
    <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
    <link href="static/DataTables-1.10.4/media/css/jquery.dataTables.min.css" rel="stylesheet">
    <link href="static/bootstrap-3.3.0-dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="static/font-awesome-4.2.0/css/font-awesome.min.css" rel="stylesheet">
    <link href="static/bootstrap-multiselect-0.9.10/dist/css/bootstrap-multiselect.css" rel="stylesheet">
    <link href="static/bootstrap-daterangepicker-1.3.16/daterangepicker-bs3.css" rel="stylesheet">
    <link href="static/css/main.css" rel="stylesheet">

    <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
    <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
    <script type="text/javascript" src="static/DataTables-1.10.4/media/js/jquery.dataTables.min.js"></script>
    <script type="text/javascript" src="static/bootstrap-3.3.0-dist/js/bootstrap.min.js"></script>
    <script type="text/javascript" src="static/bootstrap-multiselect-0.9.10/dist/js/bootstrap-multiselect.js"></script>
    <script type="text/javascript" src="static/bootstrap-daterangepicker-1.3.16/moment.min.js"></script>
    <script type="text/javascript" src="static/bootstrap-daterangepicker-1.3.16/daterangepicker.js"></script>
    <script type="text/javascript" src="static/js/perf_lib.js"></script>
    <script type="text/javascript" src="static/js/main.js"></script>
    <script>
        var data = {{!table_data}};
    </script>
</head>
<body>
<div id="wrapper">
    <div class="container-fluid">
        <div class="navbar navbar-default navbar-fixed-top" role="navigation">
            <div class="container-fluid">
                <div class="navbar-header">
                    <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </button>
                    <a class="navbar-brand" href="#">MongoDB: mongo-perf benchmark results</a>
                </div>
                <div class="navbar-collapse collapse">
                    <ul class="nav navbar-nav">
                        <li><a href="/">Home</a></li>
                    </ul>
                </div>
                <!--/.nav-collapse -->
            </div>
        </div>
        <div id="selection" class="mainbody row">
            <form name="custom_form" id="custom_form" action="results"
                  method="get" role="form">
                <div class="col-md-2">

                        <div class="sidebar affix" data-spy="affix" data-offset-top="60">
                            <button onclick="captureSelected()" action="submit" class="btn btn-primary btn-block">Submit</button>
                            <h3>Filters</h3>
                            <div class="form-group form-group-sm">
                                <label for="commit_date_filter"  class="control-label">Commit Date</label>
                                <div class="input-group">
                                    <span class="input-group-addon"><i class="fa fa-calendar"></i></span><input type="text" id="commit_date_filter" class="form-control input-sm" value="" />
                                </div>

                                <label for="commitfield"  class="control-label">Commit Hash</label>
                                <input type="text" id="commitfield" class="form-control input-sm">

                                <label for="labelfield" class="control-label">Label</label>
                                <input type="text" id="labelfield" class="form-control input-sm">

                                <label for="platform_filter"  class="control-label">Platform</label>
                                <div class="input-group">
                                    <select multiple="multiple" id="platform_filter" class="form-control input-sm">
                                        %for platform in platforms:
                                        <option value="{{platform['platform']}}">{{platform['platform']}}</option>
                                        %end
                                    </select>
                                    <button type="button" id="platform_reset_button" class="btn btn-default"><i class="fa fa-times-circle"></i></button>
                                </div>

                                <label for="rundate_filter"  class="control-label">Run Date</label>
                                <div class="input-group">
                                    <span class="input-group-addon"><i class="fa fa-calendar"></i></span><input type="text" id="rundate_filter" class="form-control input-sm" value="" />
                                </div>

                                <label for="engine_filter"  class="control-label">Storage Engine</label>
                                <div class="input-group">
                                    <select multiple="multiple" id="engine_filter" class="form-control input-sm">
                                        %for storage_engine in storage_engines:
                                        <option value="{{storage_engine['server_storage_engine']}}">{{storage_engine['server_storage_engine']}}</option>
                                        %end
                                    </select>
                                    <button type="button" id="engine_reset_button" class="btn btn-default"><i class="fa fa-times-circle"></i></button>
                                </div>

                                <label for="test_filter"  class="control-label">Test</label>
                                <div class="input-group">
                                    <select multiple="multiple" id="test_filter" class="form-control input-sm">
                                        %for test in tests:
                                        <option value="{{test}}">{{test}}</option>
                                        %end
                                    </select>
                                    <button type="button" id="test_reset_button" class="btn btn-default"><i class="fa fa-times-circle"></i></button>
                                </div>
                                <label for="topology_filter" class="control-label">Topology</label>
                                <div class="input-group">
                                    <select multiple="multiple" id="topology_filter" class="form-control input-sm">
                                        %for topology in topologies:
                                        <option value="{{topology['topology']}}">{{topology['topology']}}</option>
                                        %end
                                    </select>
                                    <button type="button" id="topology_reset_button" class="btn btn-default"><i class="fa fa-times-circle"></i></button>
                                </div>
                                <label for="version_filter" class="control-label">Version</label>
                                <div class="input-group">
                                    <select multiple="multiple" id="version_filter" class="form-control input-sm">
                                        %for version in versions:
                                        <option value="{{version['version']}}">{{version['version']}}</option>
                                        %end
                                    </select>
                                    <button type="button" id="version_reset_button" class="btn btn-default"><i class="fa fa-times-circle"></i></button>
                                </div>
                            </div>
                        </div>

                </div>
                <div class="col-md-10" role="main">
                    <table id="selectTable" class="table table-striped table-responsive display">
                        <thead>
                        <tr>
                            <th style="width: 3%"></th>
                            <th style="">Label</th>
                            <th style="width: 10%">Version</th>
                            <th style="width: 15%">Run Date</th>
                            <th style="width: 10%">Git Hash</th>
                            <th style="width: 10%">Storage Engine</th>
                        </tr>
                        </thead>
                    </table>
                </div>
            </form>
        </div>
    </div>
</div>
</body>
</html>
