<!doctype html>
<html lang="us">
  <head>
    <meta charset="utf-8">
    <title>MongoDB Performance Benchmarks</title>
    <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
    <link href="static/css/perf_style.css" rel="stylesheet">
    <link href="static/bootstrap-3.1.1-dist/css/bootstrap.min.css" rel="stylesheet">
    <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
    <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
    <script type="text/javascript" src="static/js/perf_lib.js"></script>
  </head>
  <body>
    <h1>MongoDB Performance Benchmarks</h1>
    <div id="selection">
      <form name="custom_form" id="custom_form" action="results" method="get">
        <button action="submit">Submit</button>
        <table class="table table-striped">
          <tr>
            <td></td>
            <td><input type="text" name="commit" />
            <td><input type="text" name="date" />
            <td><input type="text" name="label" />
          </tr>
          <tr>
            <th>Select</th>
            <th>Git Hash</th>
            <th>Date</th>
            <th>Label</th>
          </tr>
          %for row in allrows:
          <tr>
            <td><input type="checkbox" name="id" value={{row["_id"]}}></td>
            <td>{{row["commit"]}}</td>
            <td>{{row["date"]}}</td>
            <td>{{row["label"]}}</td>
          </tr>
          %end
        </table>
        <button action="submit">Submit</button>
      </form>
    </div>
  </body>
</html>
