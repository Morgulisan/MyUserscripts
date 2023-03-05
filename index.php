<?php
// Get the current directory path
$dir_path = './';

// Open the directory
if ($handle = opendir($dir_path)) {

    // Initialize the HTML output variable
    $html = '<html><head><style>
        body {
            background-color: #1e1e1e;
            color: #ffffff;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
        }
        table {
            margin: 0 auto;
            width: 70%;
            border-collapse: collapse;
        }
        th, td {
            padding: 10px;
            text-align: left;
            vertical-align: top;
            border: 1px solid #333333;
        }
        th {
            background-color: #333333;
            color: #ffffff;
            font-weight: bold;
        }
        a {
            color: #ffffff;
            text-decoration: none;
        }
    </style></head><body><table>';

    // Initialize the file count
    $count = 1;

    // Loop through all the files in the directory
    while (false !== ($file = readdir($handle))) {

        // Ignore the "." and ".." directories and this PHP file itself
        if ($file != "." && $file != ".." && $file != basename(__FILE__) && strpos($file, '.user.js') !== false) {

            // Read the content of the line starting with "// @description" from the file
            $description = '';
            $file_handle = fopen($file, 'r');
            if ($file_handle) {
                while (($line = fgets($file_handle)) !== false) {
                    if (strpos($line, '// @description') === 0) {
                        $description = trim(substr($line, strlen('// @description')));
                        break;
                    }
                }
                fclose($file_handle);
            }

            // Add the file and description to the HTML output as a new row in the table
            $html .= '<tr><td>' . $count . '</td><td><a href="' . $file . '">' . $file . '</a></td><td>' . $description . '</td></tr>';

            // Increment the file count
            $count++;
        }
    }

    // Close the directory
    closedir($handle);

    // Add the closing HTML tags
    $html .= '</table></body></html>';

    // Output the HTML
    echo $html;
}
?>
