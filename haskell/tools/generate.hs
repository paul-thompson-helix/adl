#!/usr/bin/env stack
{- stack --install-ghc runghc -}
{-# LANGUAGE OverloadedStrings #-}

-- Run adlc-bootstrap compiler to regenerate the haskell code for ADL
-- specified types.
--
-- It would be nice to have this within the stack build process, but
-- stack/cabal still doesn't support dependencies on build tools
-- properly.

import Data.Monoid
import System.FilePath((</>))
import System.Process(system)

adlstdlibdir = "compiler/lib/adl"

compile compiler args adldir outdir path0 = do
  let path = adldir </> path0
  system
    (  "stack exec " <> compiler <> " -- haskell "
    <> "--moduleprefix=ADL "
    <> "--no-overwrite "
    <> "-O " <> outdir <> " "
    <> "-I " <> adldir <> " "  
    <> "-I " <> adlstdlibdir <> " "
    <> args
    <> path
    )

adlcb = compile "adlc-bootstrap" ""
adlc = compile "adlc" "--verbose "

main = do
  -- compiler annotation types
  adlcb "compiler/lib/adl/adlc/config" "compiler/src" "haskell.adl"
  adlcb "compiler/lib/adl/adlc/config" "compiler/src" "cpp.adl"
  adlcb "compiler/lib/adl/adlc/config" "compiler/src" "java.adl"
  
  -- runtime
  adlcb adlstdlibdir "runtime/src" "sys/types.adl"
  adlcb adlstdlibdir "runtime/src" "sys/rpc.adl"
  adlcb adlstdlibdir "runtime/src" "sys/sinkimpl.adl"
  adlcb adlstdlibdir "runtime/src" "sys/adlast.adl"

  -- examples
  adlc "examples/adl" "examples" "examples/echo.adl"
  adlc "examples/adl" "examples" "examples/kvstore1.adl"
  adlc "examples/adl" "examples" "examples/kvstore2.adl"
  adlc "examples/adl" "examples" "examples/pubsub.adl"
  adlc "examples/adl" "examples" "examples/pubsub1.adl"
  adlc "examples/adl" "examples" "examples/datetime.adl"
  adlc "examples/adl" "examples" "examples/serialisation.adl"
