#!/bin/bash

set -e

HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HASKELLDIR=$HERE/../../haskell
ADLSTDLIBDIR=$(cd $HASKELLDIR; stack exec adlc -- show --adlstdlib)

# Build ADL and dependencies setup
(cd $HASKELLDIR; stack build ./compiler)


runtests() {
  echo "--------- testing $1 ---------"
  TESTDIR=$HERE/$1

  echo "### Generating typescript from adl"
  BUILDDIR=$TESTDIR/build
  rm -rf $BUILDDIR
  mkdir -p $BUILDDIR
  (cd $HASKELLDIR; stack exec adlc -- typescript -I $ADLSTDLIBDIR -O $BUILDDIR --include-rt --include-resolver --runtime-dir runtime $HERE/example.adl $ADLSTDLIBDIR/sys/types.adl $ADLSTDLIBDIR/sys/adlast.adl $ADLSTDLIBDIR/sys/dynamic.adl)

  echo "### Setting up node_modules"
  cd $TESTDIR
  yarn

  echo "### Compiling typescript"
  cp tsconfig.json $BUILDDIR
  rm -rf $BUILDDIR/tsc-out
  ./node_modules/.bin/tsc --outDir $BUILDDIR/tsc-out -p $BUILDDIR; rm -rf $BUILDDIR/tsc-out

  echo "### Linting typescript"
  ./node_modules/.bin/tslint -c tslint.json -p $BUILDDIR

  echo "### Running tests"
  yarn test
}

runtests ts-2.9.2
runtests ts-3.5.2
runtests ts-3.8.3
