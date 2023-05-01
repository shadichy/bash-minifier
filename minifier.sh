#!/bin/bash

minifier() {
  echo "#!/bin/${shell:-bash}"
  sed -r \
    -e ':a;N;$!ba;s/(^(\s*(#.*\n)?|\n+))//gm' \
    -e "s/(=|echo )(''|\"\")/\1/gm" \
    -e 's/"([A-Za-z0-9_.-]+)"/\1/gm' \
    -e 's/\)\s+\{/\)\{/gm' \
    -e 's/\s*(;|\((\)|\(|!|\?)|[<>][<=>])\s*/\1/gm' \
    -e 's/\s+(\))/\1/gm' \
    -e 's/==/=/gm' \
    -e 's/([^<])\s+</\1</gm' \
    -e ':a;N;$!ba;s/([^\\])\\\n/\1 /gm' \
    -e ':a;N;$!ba;s/^([^\(]+)\)\s*\n*(.+)$/\1)\2/gm' \
    -e ':a;N;$!ba;s/\s*\n*((;|\||&){1,2})\s*\n*/\1/gm' \
    -e 's/\s+$//gm' \
    -e 's/"\$\?"/\$\?/gm' \
    -e "s/\((\"\"|'')\)/\(\)/gm" \
    -e 's/ {2,}/ /gm' "$@"
  return $?
}

if [ ! "$*" ]; then
  echo "Error: no input specified!"
  exit 1
fi

while [ "$*" ]; do

  case "$1" in
  -o | --output) out=$2 && shift ;;
  -o=* | --output=*) out=${1#*=} ;;
  --shell | -sh) shell=$2 && shift ;;
  --shell=* | -sh=*) shell=${1#*=} ;;
  -h | --help)
    cat <<EOF
BASH minifier by Shadichy

Usage: $0 (-o output) (-sh shell) (-h) file1 file2 ...

  -o, --output    specify output file
  -sh, --shell    specify output #\!/bin/shellname
  -h, --help      print this help

EOF
    exit 0
    ;;
  *) break ;;
  esac
  shift
done

if [ "$out" ]; then
  [[ $out = *"/"* ]] && mkdir -p "${out%/*}"
  minifier "$@" >"$out"
else
  minifier "$@"
fi

exit $?
